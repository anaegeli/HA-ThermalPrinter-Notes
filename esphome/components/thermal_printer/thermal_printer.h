#pragma once

#include "esphome/components/uart/uart.h"
#include "esphome/core/component.h"
#include "esphome/core/hal.h"
#include "esphome/core/log.h"

#include <algorithm>
#include <cctype>
#include <cstddef>
#include <cstdint>
#include <deque>
#include <initializer_list>
#include <memory>
#include <sstream>
#include <string>
#include <utility>
#include <vector>

// Header-only ESC/POS driver for the Cashino EP-261C and EP-382C.
// UART: ESP32 GPIO4 (TX) -> printer RX, GPIO5 (RX) <- printer TX, 9600 8N1.
//
// Character configuration used here:
//   ESC R 0  : neutral international character set (keeps ASCII unchanged)
//   ESC t 16 : Windows-1252 / Latin I
// Incoming Home Assistant strings are UTF-8 and are converted to Windows-1252.
// The EP-261C selftest confirms CP1252 Latin1 as its default code page.

namespace esphome::thermal_printer {

static constexpr uint8_t TP_ESC = 0x1B;
static constexpr uint8_t TP_FS = 0x1C;
static constexpr uint8_t TP_GS = 0x1D;
static constexpr uint8_t TP_DLE = 0x10;
static constexpr uint8_t TP_EOT = 0x04;
static constexpr uint8_t TP_LF = 0x0A;
static constexpr uint8_t TP_CODE_PAGE = 16;          // Windows-1252 / Latin I
static constexpr uint8_t TP_INTERNATIONAL_SET = 0;  // Preserve standard ASCII
static constexpr size_t TP_MAX_SOURCE_BYTES = 16384;
static constexpr size_t TP_MAX_RENDERED_BYTES = 98304;
static constexpr size_t TP_MAX_QUEUED_BYTES = 131072;
static constexpr size_t TP_MAX_QUEUE_JOBS = 5;
static constexpr size_t TP_TX_CHUNK = 16;  // 800 B/s at one chunk per 20 ms

struct PrintOptions {
  uint8_t alignment{0};  // 0 left, 1 centered, 2 right
  uint8_t size{0};       // 0 normal, 1 double width, 2 double size, 3 small
  uint8_t feed_lines{4};
  // Firmware extension: ESC { is not documented in the EP-261C manual but is
  // confirmed on SV2.00.02; it is documented in the EP-382C manual (p. 23).
  bool reverse_print{false};
  bool cut{true};
  std::string header_left;
  std::string header_right;
};

class ThermalPrinterComponent : public Component, public uart::UARTDevice {
 public:
  ThermalPrinterComponent() = default;

  // Compatibility constructor for installations which still instantiate the
  // driver from a YAML lambda instead of the external component schema.
  explicit ThermalPrinterComponent(uart::UARTComponent *parent)
      : uart::UARTDevice(parent) {}

  void set_ep_382c(bool enabled) { ep_382c_ = enabled; }
  const char *model() const { return ep_382c_ ? "EP-382C" : "EP-261C"; }
  size_t columns() const { return ep_382c_ ? 48 : 32; }
  size_t small_columns() const { return ep_382c_ ? 64 : 42; }

  void setup() override { begin(); }

  float get_setup_priority() const override { return setup_priority::DATA; }

  void dump_config() override {
    ESP_LOGCONFIG("thermal_printer", "Cashino %s Thermal Printer (%u/%u columns)",
                  model(), static_cast<unsigned>(columns()),
                  static_cast<unsigned>(small_columns()));
    ESP_LOGCONFIG("thermal_printer", "  Driver version: 0.8.0");
  }

  void begin() {
    initialized_ = true;
    last_status_cycle_ms_ = millis() - STATUS_INTERVAL_MS;
    notice_ = "Bereit (Status wird abgefragt)";
    notice_until_ms_ = millis() + 2000;
    const std::vector<uint8_t> init = build_init_only_();
    write_array(init.data(), init.size());
    last_tx_ms_ = millis();
    ESP_LOGI("thermal_printer", "%s driver initialized", model());
  }

  // ESPHome calls this automatically; transmission is internally paced to
  // one small chunk every 20 ms so API and Ethernet handling stay responsive.
  void loop() override {
    if (!initialized_) return;

    receive_status_();
    const uint32_t now = millis();

    if (!jobs_.empty()) {
      Job &job = jobs_.front();
      // Cashino specifies more than 3 seconds per cutter operation. Delay a
      // new cutting job conservatively; non-cutting feed/print jobs may start
      // immediately.
      if (job.contains_cut && job.offset == 0 && last_cut_ms_ != 0 &&
          now - last_cut_ms_ < CUT_COOLDOWN_MS) {
        return;
      }
      if (now - last_tx_ms_ >= 20) {
        const size_t remaining = job.bytes->size() - job.offset;
        const size_t count = std::min(remaining, TP_TX_CHUNK);
        if (count > 0) {
          write_array(job.bytes->data() + job.offset, count);
          job.offset += count;
          last_tx_ms_ = now;
        }
        if (job.offset >= job.bytes->size()) {
          const bool contained_cut = job.contains_cut;
          if (job.bytes.use_count() == 1) {
            queued_rendered_bytes_ -= job.bytes->size();
          }
          jobs_.pop_front();
          last_print_finished_ms_ = now;
          if (contained_cut) last_cut_ms_ = now;
        }
      }
      return;
    }

    poll_status_(now);
  }

  bool enqueue_markdown(const std::string &markdown, const PrintOptions &options,
                        uint8_t copies = 1) {
    if (!initialized_) return reject_("Treiber noch nicht bereit");
    if (markdown.empty()) return reject_("Leerer Druckauftrag");
    if (markdown.size() > TP_MAX_SOURCE_BYTES)
      return reject_("Text groesser als 16384 Bytes");
    if (copies < 1 || copies > 5)
      return reject_("Kopien muessen zwischen 1 und 5 liegen");
    if (known_hard_error_())
      return reject_(status_from_hardware_());
    if (jobs_.size() + copies > TP_MAX_QUEUE_JOBS)
      return reject_("Druckwarteschlange voll");

    std::vector<uint8_t> rendered_bytes = render_document_(markdown, options);
    if (rendered_bytes.size() > TP_MAX_RENDERED_BYTES)
      return reject_("Formatierter Druckauftrag zu gross");
    if (queued_rendered_bytes_ + rendered_bytes.size() > TP_MAX_QUEUED_BYTES)
      return reject_("Nicht genug freier Druckpuffer");
    auto rendered = std::make_shared<const std::vector<uint8_t>>(
        std::move(rendered_bytes));
    for (uint8_t i = 0; i < copies; i++) {
      Job job;
      job.bytes = rendered;
      job.contains_cut = options.cut;
      jobs_.push_back(std::move(job));
    }
    queued_rendered_bytes_ += rendered->size();
    notice_.clear();
    notice_until_ms_ = 0;
    ESP_LOGI("thermal_printer", "Queued %u copy/copies, %u source bytes",
             static_cast<unsigned>(copies),
             static_cast<unsigned>(markdown.size()));
    return true;
  }

  bool enqueue_feed(uint8_t lines) {
    if (!initialized_) return reject_("Treiber noch nicht bereit");
    if (jobs_.size() >= TP_MAX_QUEUE_JOBS)
      return reject_("Druckwarteschlange voll");
    std::vector<uint8_t> bytes;
    append_(bytes, {TP_ESC, 'd', static_cast<uint8_t>(std::min<uint8_t>(lines, 20))});
    enqueue_bytes_(std::move(bytes));
    return true;
  }

  bool enqueue_test_page() {
    PrintOptions options;
    options.feed_lines = 4;
    options.cut = true;
    return enqueue_markdown(
        "# Testdruck\n"
        "ASCII: Ae Oe Ue ae oe ue ss EUR\n"
        "UTF-8: Ä Ö Ü ä ö ü ß €\n"
        "---\n"
        "- ESC/POS\n"
        "- [x] UART verbunden\n"
        "- [ ] Status pruefen\n"
        "**Fett** und *unterstrichen*\n",
        options, 1);
  }

  size_t queue_depth() const { return jobs_.size(); }

  bool ready() const {
    return initialized_ && jobs_.empty() && status_fresh_() &&
           !known_hard_error_();
  }

  std::string status_text() const {
    const uint32_t now = millis();
    if (!initialized_) return "Startet";
    if (!jobs_.empty()) {
      const Job &job = jobs_.front();
      if (job.contains_cut && job.offset == 0 && last_cut_ms_ != 0 &&
          now - last_cut_ms_ < CUT_COOLDOWN_MS)
        return "Wartet auf Schneidwerk";
      return "Druckt (" + std::to_string(jobs_.size()) +
             (jobs_.size() == 1 ? " Auftrag)" : " Auftraege)");
    }
    if (!notice_.empty() && static_cast<int32_t>(notice_until_ms_ - now) > 0)
      return notice_;
    return status_from_hardware_();
  }

 private:
  struct Job {
    std::shared_ptr<const std::vector<uint8_t>> bytes;
    size_t offset{0};
    bool contains_cut{false};
  };

  struct StyledChar {
    uint8_t value;
    bool bold;
    bool underline;
    bool wide;
  };

  struct PrintStyle {
    uint8_t font{0};       // 0: 12x24, 1: 9x17
    uint8_t size{0};       // 0: normal, 1: double width, 2: double size
    bool bold{false};
    bool underline{false};
  };

  static constexpr uint32_t STATUS_INTERVAL_MS = 5000;
  static constexpr uint32_t STATUS_TIMEOUT_MS = 300;
  static constexpr uint32_t STATUS_STALE_MS = 15000;
  static constexpr uint32_t CUT_COOLDOWN_MS = 3200;

  std::deque<Job> jobs_;
  size_t queued_rendered_bytes_{0};
  bool ep_382c_{false};
  bool initialized_{false};
  uint32_t last_tx_ms_{0};
  uint32_t last_print_finished_ms_{0};
  uint32_t last_cut_ms_{0};
  uint32_t last_status_cycle_ms_{0};
  uint32_t status_query_sent_ms_{0};
  uint32_t last_status_response_ms_{0};
  uint8_t pending_status_query_{0};
  uint8_t next_status_query_{1};
  uint8_t status_[5]{0, 0, 0, 0, 0};
  bool status_valid_[5]{false, false, false, false, false};
  std::string notice_;
  uint32_t notice_until_ms_{0};

  bool reject_(const std::string &message) {
    notice_ = "Abgewiesen: " + message;
    notice_until_ms_ = millis() + 10000;
    ESP_LOGW("thermal_printer", "%s", notice_.c_str());
    return false;
  }

  void enqueue_bytes_(std::vector<uint8_t> bytes, bool contains_cut = false) {
    Job job;
    job.bytes = std::make_shared<const std::vector<uint8_t>>(std::move(bytes));
    job.contains_cut = contains_cut;
    queued_rendered_bytes_ += job.bytes->size();
    jobs_.push_back(std::move(job));
  }

  static void append_(std::vector<uint8_t> &out,
                      std::initializer_list<uint8_t> bytes) {
    out.insert(out.end(), bytes.begin(), bytes.end());
  }

  static void append_text_(std::vector<uint8_t> &out,
                           const std::string &text) {
    out.insert(out.end(), text.begin(), text.end());
  }

  static void set_alignment_(std::vector<uint8_t> &out, uint8_t value) {
    append_(out, {TP_ESC, 'a', static_cast<uint8_t>(std::min<uint8_t>(value, 2))});
  }

  static uint8_t print_mode_(const PrintStyle &style) {
    uint8_t value = style.font == 1 ? 0x01 : 0x00;
    if (style.bold) value |= 0x08;
    if (style.size == 1) value |= 0x20;
    if (style.size == 2) value |= 0x30;
    if (style.underline) value |= 0x80;
    return value;
  }

  static void emit_print_mode_(std::vector<uint8_t> &out,
                               const PrintStyle &style) {
    // ESC ! is the EP-261C-documented command for font, bold, size and
    // underline. This avoids relying on the undocumented ESC E and ESC M.
    append_(out, {TP_ESC, '!', print_mode_(style)});
  }

  static uint8_t character_size_(uint8_t size) {
    if (size == 1) return 0x10;  // 2x width, normal height.
    if (size == 2) return 0x11;  // 2x width and 2x height.
    return 0x00;
  }

  static void emit_character_size_(std::vector<uint8_t> &out,
                                   const PrintStyle &style) {
    // The EP-261C documents GS ! as the dedicated character-size command.
    // Emitting it together with ESC ! makes size changes within a buffered
    // line reliable while ESC ! continues to carry font and text styles.
    append_(out, {TP_GS, '!', character_size_(style.size)});
  }

  static void set_bold_(std::vector<uint8_t> &out, PrintStyle &style,
                        bool enabled) {
    if (style.bold == enabled) return;
    style.bold = enabled;
    emit_print_mode_(out, style);
  }

  static void set_underline_(std::vector<uint8_t> &out, PrintStyle &style,
                             bool enabled) {
    if (style.underline == enabled) return;
    style.underline = enabled;
    emit_print_mode_(out, style);
  }

  static void set_size_(std::vector<uint8_t> &out, PrintStyle &style,
                        uint8_t size) {
    const uint8_t limited = std::min<uint8_t>(size, 2);
    if (style.size == limited) return;
    style.size = limited;
    emit_print_mode_(out, style);
    emit_character_size_(out, style);
  }

  static void set_font_(std::vector<uint8_t> &out, PrintStyle &style,
                        uint8_t font) {
    const uint8_t limited = font == 1 ? 1 : 0;
    if (style.font == limited) return;
    style.font = limited;
    emit_print_mode_(out, style);
  }

  static void set_line_spacing_(std::vector<uint8_t> &out, uint8_t dots) {
    append_(out, {TP_ESC, '3', dots});
  }

  static uint8_t line_spacing_(uint8_t size, uint8_t font) {
    if (size == 2) return 54;  // 48-dot glyph plus 6-dot gap.
    if (font == 1) return 23;  // 17-dot glyph plus 6-dot gap.
    return 30;                 // 24-dot glyph plus 6-dot gap.
  }

  static uint8_t option_font_(const PrintOptions &options) {
    return options.size == 3 ? 1 : 0;
  }

  static uint8_t option_size_(const PrintOptions &options) {
    return options.size == 3 ? 0 : std::min<uint8_t>(options.size, 2);
  }

  size_t option_columns_(const PrintOptions &options) const {
    if (options.size == 3) return small_columns();
    return options.size == 0 ? columns() : columns() / 2;
  }

  static void apply_option_style_(std::vector<uint8_t> &out,
                                  const PrintOptions &options,
                                  PrintStyle &style) {
    set_font_(out, style, option_font_(options));
    set_size_(out, style, option_size_(options));
    set_line_spacing_(out, line_spacing_(style.size, style.font));
  }

  static void set_upside_down_(std::vector<uint8_t> &out, bool enabled) {
    // Empirically supported by the installed printer firmware, but absent from
    // the official EP-261C command list. Only emit it for reverse printing.
    append_(out, {TP_ESC, '{', static_cast<uint8_t>(enabled ? 1 : 0)});
  }

  static std::vector<uint8_t> build_init_only_() {
    std::vector<uint8_t> out;
    append_(out, {TP_ESC, '@'});
    append_(out, {TP_FS, '.'});  // Leave Chinese double-byte character mode.
    append_(out, {TP_ESC, 'R', TP_INTERNATIONAL_SET});
    append_(out, {TP_ESC, 't', TP_CODE_PAGE});
    set_alignment_(out, 0);
    append_(out, {TP_ESC, '!', 0x00});
    set_line_spacing_(out, 30);
    return out;
  }

  static uint32_t decode_utf8_(const std::string &input, size_t &index) {
    const uint8_t c0 = static_cast<uint8_t>(input[index++]);
    if (c0 < 0x80) return c0;
    if ((c0 & 0xE0) == 0xC0 && index < input.size()) {
      const uint8_t c1 = static_cast<uint8_t>(input[index++]);
      if ((c1 & 0xC0) == 0x80)
        return ((c0 & 0x1F) << 6) | (c1 & 0x3F);
    } else if ((c0 & 0xF0) == 0xE0 && index + 1 < input.size()) {
      const uint8_t c1 = static_cast<uint8_t>(input[index++]);
      const uint8_t c2 = static_cast<uint8_t>(input[index++]);
      if ((c1 & 0xC0) == 0x80 && (c2 & 0xC0) == 0x80)
        return ((c0 & 0x0F) << 12) | ((c1 & 0x3F) << 6) | (c2 & 0x3F);
    } else if ((c0 & 0xF8) == 0xF0 && index + 2 < input.size()) {
      index += 3;  // Windows-1252 cannot represent this code point.
    }
    return '?';
  }

  static uint8_t to_windows_1252_(uint32_t cp) {
    if (cp >= 0x20 && cp <= 0x7E) return static_cast<uint8_t>(cp);
    if (cp >= 0x00A0 && cp <= 0x00FF) return static_cast<uint8_t>(cp);
    switch (cp) {
      case 0x20AC: return 0x80;  // EUR
      case 0x201A: return 0x82;
      case 0x0192: return 0x83;
      case 0x201E: return 0x84;
      case 0x2026: return 0x85;
      case 0x2020: return 0x86;
      case 0x2021: return 0x87;
      case 0x2030: return 0x89;
      case 0x0160: return 0x8A;
      case 0x2039: return 0x8B;
      case 0x0152: return 0x8C;
      case 0x017D: return 0x8E;
      case 0x2018: return 0x91;
      case 0x2019: return 0x92;
      case 0x201C: return 0x93;
      case 0x201D: return 0x94;
      case 0x2022: return 0x95;
      case 0x2013: return 0x96;
      case 0x2014: return 0x97;
      case 0x2122: return 0x99;
      case 0x0161: return 0x9A;
      case 0x203A: return 0x9B;
      case 0x0153: return 0x9C;
      case 0x017E: return 0x9E;
      case 0x0178: return 0x9F;
      case '\t': return ' ';
      default: return '?';
    }
  }

  static std::string utf8_to_windows_1252_(const std::string &input) {
    std::string result;
    result.reserve(input.size());
    size_t index = 0;
    while (index < input.size()) {
      const uint32_t cp = decode_utf8_(input, index);
      if (cp == '\r') continue;
      if (cp == '\n') {
        result.push_back('\n');
      } else {
        result.push_back(static_cast<char>(to_windows_1252_(cp)));
      }
    }
    return result;
  }

  static std::string truncate_with_ellipsis_(const std::string &text,
                                              size_t max_length) {
    if (text.size() <= max_length) return text;
    if (max_length <= 3) return text.substr(0, max_length);
    return text.substr(0, max_length - 3) + "...";
  }

  void render_header_(std::vector<uint8_t> &out,
                      const PrintOptions &options, PrintStyle &style) {
    std::string left = utf8_to_windows_1252_(options.header_left);
    std::string right = utf8_to_windows_1252_(options.header_right);
    if (left.empty() && right.empty()) return;

    right = truncate_with_ellipsis_(right, small_columns());
    const size_t right_start = small_columns() - right.size();
    const size_t left_limit = right.empty()
                                  ? small_columns()
                                  : (right_start > 0 ? right_start - 1 : 0);
    left = truncate_with_ellipsis_(left, left_limit);

    std::string line = left;
    if (!right.empty()) {
      if (line.size() < right_start)
        line.append(right_start - line.size(), ' ');
      line += right;
    }

    set_alignment_(out, 0);
    set_size_(out, style, 0);
    set_bold_(out, style, false);
    set_underline_(out, style, false);
    set_font_(out, style, 1);
    set_line_spacing_(out, line_spacing_(style.size, style.font));
    append_text_(out, line);
    out.push_back(TP_LF);
    set_font_(out, style, 0);
  }

  static std::vector<std::string> split_lines_(const std::string &text) {
    std::vector<std::string> lines;
    std::istringstream stream(text);
    std::string line;
    while (std::getline(stream, line)) lines.push_back(line);
    if (!text.empty() && text.back() == '\n') lines.emplace_back();
    return lines;
  }

  static bool starts_with_(const std::string &text, const std::string &prefix) {
    return text.size() >= prefix.size() &&
           text.compare(0, prefix.size(), prefix) == 0;
  }

  static std::string simplify_links_(const std::string &text) {
    std::string out;
    size_t pos = 0;
    while (pos < text.size()) {
      const size_t open = text.find('[', pos);
      if (open == std::string::npos) {
        out += text.substr(pos);
        break;
      }
      const size_t middle = text.find("](", open + 1);
      if (middle == std::string::npos) {
        out += text.substr(pos);
        break;
      }
      const size_t close = text.find(')', middle + 2);
      if (close == std::string::npos) {
        out += text.substr(pos);
        break;
      }
      out += text.substr(pos, open - pos);
      out += text.substr(open + 1, middle - open - 1);
      out += " (";
      out += text.substr(middle + 2, close - middle - 2);
      out += ')';
      pos = close + 1;
    }
    return out;
  }

  static std::vector<StyledChar> parse_inline_(const std::string &source) {
    const std::string text = simplify_links_(source);
    std::vector<StyledChar> chars;
    bool bold = false;
    bool underline = false;
    bool wide = false;
    for (size_t i = 0; i < text.size();) {
      if (i + 1 < text.size() && text[i] == '*' && text[i + 1] == '*') {
        bold = !bold;
        i += 2;
      } else if (i + 1 < text.size() && text[i] == '=' &&
                 text[i + 1] == '=' &&
                 (wide || text.find("==", i + 2) != std::string::npos)) {
        wide = !wide;
        i += 2;
      } else if (text[i] == '*') {
        underline = !underline;  // ESC/POS has no portable italic command.
        i++;
      } else {
        chars.push_back(
            {static_cast<uint8_t>(text[i]), bold, underline, wide});
        i++;
      }
    }
    return chars;
  }

  static void emit_styled_range_(std::vector<uint8_t> &out,
                                 const std::vector<StyledChar> &chars,
                                 size_t begin, size_t end,
                                 PrintStyle &style) {
    const bool base_bold = style.bold;
    const bool base_underline = style.underline;
    const uint8_t base_size = style.size;
    for (size_t i = begin; i < end; i++) {
      set_bold_(out, style, base_bold || chars[i].bold);
      set_underline_(out, style, base_underline || chars[i].underline);
      set_size_(out, style,
                chars[i].wide && base_size == 0 ? 1 : base_size);
      out.push_back(chars[i].value);
    }
    set_bold_(out, style, base_bold);
    set_underline_(out, style, base_underline);
    set_size_(out, style, base_size);
    out.push_back(TP_LF);
  }

  static size_t char_columns_(const StyledChar &character,
                              uint8_t base_size) {
    return character.wide && base_size == 0 ? 2 : 1;
  }

  static void append_wrapped_(std::vector<uint8_t> &out,
                              const std::string &source, size_t columns,
                              bool reverse_lines, PrintStyle &style) {
    const std::vector<StyledChar> chars = parse_inline_(source);
    if (chars.empty()) {
      out.push_back(TP_LF);
      return;
    }
    std::vector<std::pair<size_t, size_t>> ranges;
    size_t begin = 0;
    const uint8_t base_size = style.size;
    while (begin < chars.size()) {
      size_t end = begin;
      size_t used_columns = 0;
      size_t last_space = std::string::npos;
      while (end < chars.size()) {
        const size_t width = char_columns_(chars[end], base_size);
        if (used_columns + width > columns) break;
        used_columns += width;
        if (chars[end].value == ' ') last_space = end;
        end++;
      }
      if (end < chars.size() && last_space != std::string::npos &&
          last_space > begin)
        end = last_space;
      if (end == begin) end++;
      ranges.emplace_back(begin, end);
      begin = end;
      while (begin < chars.size() && chars[begin].value == ' ') begin++;
    }

    if (reverse_lines) {
      for (auto it = ranges.rbegin(); it != ranges.rend(); ++it)
        emit_styled_range_(out, chars, it->first, it->second, style);
    } else {
      for (const auto &range : ranges)
        emit_styled_range_(out, chars, range.first, range.second, style);
    }
  }

  static bool numbered_list_(const std::string &line) {
    size_t i = 0;
    while (i < line.size() && std::isdigit(static_cast<unsigned char>(line[i]))) i++;
    return i > 0 && i + 1 < line.size() && line[i] == '.' && line[i + 1] == ' ';
  }

  static bool qr_payload_(const std::string &raw_utf8, std::string &payload) {
    if (starts_with_(raw_utf8, "QR: ")) {
      payload = raw_utf8.substr(4);
      return !payload.empty();
    }
    if (starts_with_(raw_utf8, "[QR](") && raw_utf8.size() > 6 &&
        raw_utf8.back() == ')') {
      payload = raw_utf8.substr(5, raw_utf8.size() - 6);
      return !payload.empty();
    }
    return false;
  }

  static void append_qr_(std::vector<uint8_t> &out, const std::string &payload) {
    const size_t length = std::min<size_t>(payload.size(), 512);
    set_alignment_(out, 1);
    append_(out, {TP_GS, '(', 'k', 3, 0, 49, 67, 4});   // module size 4
    append_(out, {TP_GS, '(', 'k', 3, 0, 49, 69, 49});  // correction M
    const uint16_t store_length = static_cast<uint16_t>(length + 3);
    append_(out, {TP_GS, '(', 'k', static_cast<uint8_t>(store_length & 0xFF),
                  static_cast<uint8_t>((store_length >> 8) & 0xFF), 49, 80, 48});
    out.insert(out.end(), payload.begin(), payload.begin() + length);
    append_(out, {TP_GS, '(', 'k', 3, 0, 49, 81, 48, TP_LF});
  }

  void render_line_(std::vector<uint8_t> &out,
                    const std::string &raw_utf8,
                    const PrintOptions &options,
                    bool reverse_wrapped_lines, PrintStyle &style) {
    std::string qr;
    if (qr_payload_(raw_utf8, qr)) {
      apply_option_style_(out, options, style);
      set_bold_(out, style, false);
      set_underline_(out, style, false);
      append_qr_(out, qr);
      set_alignment_(out, options.alignment);
      return;
    }

    const std::string line = utf8_to_windows_1252_(raw_utf8);
    if (line.find_first_not_of(" \t") == std::string::npos) {
      apply_option_style_(out, options, style);
      out.push_back(TP_LF);
      return;
    }

    if (starts_with_(line, "### ")) {
      set_alignment_(out, 0);
      set_font_(out, style, 0);
      set_size_(out, style, 0);
      set_bold_(out, style, true);
      set_underline_(out, style, true);
      set_line_spacing_(out, line_spacing_(style.size, style.font));
      append_wrapped_(out, line.substr(4), columns(),
                      reverse_wrapped_lines, style);
      set_underline_(out, style, false);
      set_bold_(out, style, false);
    } else if (starts_with_(line, "## ")) {
      set_alignment_(out, 1);
      set_font_(out, style, 0);
      set_size_(out, style, 1);
      set_bold_(out, style, true);
      set_line_spacing_(out, line_spacing_(style.size, style.font));
      append_wrapped_(out, line.substr(3), columns() / 2,
                      reverse_wrapped_lines, style);
      set_bold_(out, style, false);
    } else if (starts_with_(line, "# ")) {
      set_alignment_(out, 1);
      set_font_(out, style, 0);
      set_size_(out, style, 2);
      set_bold_(out, style, true);
      set_line_spacing_(out, line_spacing_(style.size, style.font));
      append_wrapped_(out, line.substr(2), columns() / 2,
                      reverse_wrapped_lines, style);
      set_bold_(out, style, false);
    } else if (line == "---" || line == "___" || line == "***") {
      set_alignment_(out, 0);
      set_font_(out, style, 0);
      set_size_(out, style, 0);
      set_line_spacing_(out, line_spacing_(style.size, style.font));
      append_text_(out, std::string(columns(), '-'));
      out.push_back(TP_LF);
    } else {
      set_alignment_(out, options.alignment);
      apply_option_style_(out, options, style);
      const size_t columns = option_columns_(options);
      if (line.size() >= 5 && starts_with_(line, "- [") && line[4] == ']') {
        const bool checked = line[3] == 'x' || line[3] == 'X';
        append_wrapped_(out, std::string(checked ? "[x] " : "[ ] ") +
                                 (line.size() > 6 ? line.substr(6) : ""),
                        columns, reverse_wrapped_lines, style);
      } else if (line.size() > 2 &&
                 ((line[0] == '-' || line[0] == '*') && line[1] == ' ')) {
        std::string bullet;
        bullet.push_back(static_cast<char>(0x95));
        bullet += " ";
        bullet += line.substr(2);
        append_wrapped_(out, bullet, columns, reverse_wrapped_lines, style);
      } else if (numbered_list_(line)) {
        append_wrapped_(out, line, columns, reverse_wrapped_lines, style);
      } else {
        append_wrapped_(out, line, columns, reverse_wrapped_lines, style);
      }
    }

    set_alignment_(out, options.alignment);
    apply_option_style_(out, options, style);
    set_bold_(out, style, false);
    set_underline_(out, style, false);
  }

  std::vector<uint8_t> render_document_(const std::string &markdown,
                                        const PrintOptions &options) {
    std::vector<uint8_t> out = build_init_only_();
    // Avoid heap fragmentation while formatting larger documents. Six output
    // bytes per input byte covers frequent ESC/POS style changes and line
    // commands without reserving the full limit for ordinary short notes.
    out.reserve(std::min<size_t>(TP_MAX_RENDERED_BYTES,
                                 markdown.size() * 6 + 256));
    PrintStyle style;
    if (options.reverse_print) set_upside_down_(out, true);
    set_alignment_(out, options.alignment);
    apply_option_style_(out, options, style);
    const std::vector<std::string> lines = split_lines_(markdown);
    if (options.reverse_print) {
      for (auto it = lines.rbegin(); it != lines.rend(); ++it)
        render_line_(out, *it, options, true, style);
      render_header_(out, options, style);
    } else {
      render_header_(out, options, style);
      for (const std::string &line : lines)
        render_line_(out, line, options, false, style);
    }
    if (options.reverse_print) set_upside_down_(out, false);
    set_alignment_(out, 0);
    set_font_(out, style, 0);
    set_size_(out, style, 0);
    set_bold_(out, style, false);
    set_underline_(out, style, false);
    set_line_spacing_(out, 30);
    append_(out, {TP_ESC, 'd', static_cast<uint8_t>(std::min<uint8_t>(options.feed_lines, 20))});
    if (options.cut) append_(out, {TP_GS, 'V', 0x00});
    return out;
  }

  void receive_status_() {
    while (available()) {
      uint8_t value = 0;
      if (!read_byte(&value)) break;
      // DLE EOT status replies have fixed bits 1 and 4 set. Ignoring other
      // bytes prevents an XON/XOFF byte from being mistaken for a status.
      if (pending_status_query_ >= 1 && pending_status_query_ <= 4 &&
          (value & 0x12) == 0x12) {
        status_[pending_status_query_] = value;
        status_valid_[pending_status_query_] = true;
        last_status_response_ms_ = millis();
        pending_status_query_ = 0;
      }
    }
  }

  void poll_status_(uint32_t now) {
    if (now - last_print_finished_ms_ < 1000) return;

    if (pending_status_query_ != 0) {
      if (now - status_query_sent_ms_ > STATUS_TIMEOUT_MS) {
        status_valid_[pending_status_query_] = false;
        pending_status_query_ = 0;
      } else {
        return;
      }
    }

    if (next_status_query_ == 1 && now - last_status_cycle_ms_ < STATUS_INTERVAL_MS)
      return;

    pending_status_query_ = next_status_query_;
    write_byte(TP_DLE);
    write_byte(TP_EOT);
    write_byte(pending_status_query_);
    status_query_sent_ms_ = now;
    next_status_query_++;
    if (next_status_query_ > 4) {
      next_status_query_ = 1;
      last_status_cycle_ms_ = now;
    }
  }

  bool status_fresh_() const {
    return last_status_response_ms_ != 0 &&
           millis() - last_status_response_ms_ <= STATUS_STALE_MS;
  }

  bool known_hard_error_() const {
    if (!status_fresh_()) return false;
    return (status_valid_[1] && (status_[1] & 0x08)) ||
           (status_valid_[2] && (status_[2] & (ep_382c_ ? 0x64 : 0x44))) ||
           (status_valid_[3] && (status_[3] & 0x68)) ||
           (status_valid_[4] && (status_[4] & 0x60));
  }

  std::string status_from_hardware_() const {
    if (!status_fresh_()) return "Status unbekannt (keine Antwort)";
    if ((status_valid_[4] && (status_[4] & 0x60)) ||
        (ep_382c_ && status_valid_[2] && (status_[2] & 0x20)))
      return "Fehler: Papier leer";
    if (status_valid_[2] && (status_[2] & 0x04)) return "Fehler: Abdeckung offen";
    if (status_valid_[3] && (status_[3] & 0x08)) return "Fehler: Schneidwerk";
    if (status_valid_[3] && (status_[3] & 0x20)) return "Fehler: Eingangsspannung";
    if (status_valid_[3] && (status_[3] & 0x40)) return "Fehler: Druckkopf/Spannung";
    if (status_valid_[2] && (status_[2] & 0x40)) return "Fehler: Druckerfehler";
    if (status_valid_[1] && (status_[1] & 0x08)) return "Fehler: Drucker offline";
    if ((status_valid_[4] && (status_[4] & 0x0C)) ||
        (status_valid_[2] && (status_[2] & 0x20)))
      return "Warnung: Papier fast leer";
    if (ep_382c_ && status_valid_[1] && (status_[1] & 0x80))
      return "Bereit (Ausdruck noch nicht entnommen)";
    return "Bereit";
  }
};

// Kept in the included header instead of an ESPHome `globals:` entry. ESPHome
// 2026.7 generates globals before user includes, so a custom C++ type cannot be
// used safely as the YAML global's declared type.
inline ThermalPrinterComponent *&driver_instance() {
  static ThermalPrinterComponent *instance = nullptr;
  return instance;
}

}  // namespace esphome::thermal_printer

using esphome::thermal_printer::PrintOptions;
using esphome::thermal_printer::ThermalPrinterComponent;
