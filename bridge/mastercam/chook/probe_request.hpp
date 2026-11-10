// probe_request.hpp — request parsing and JSON output for the param-probe CHook.
// Pure C++20, no Windows or Mastercam headers, so test/probe_request_test.cpp runs on any machine.
#pragma once
#include <charconv>
#include <cmath>
#include <cstdint>
#include <optional>
#include <stdexcept>
#include <string>
#include <string_view>

namespace capp_probe {

// The eight parameters spec S-MC asks about. The last three exist only on lathe rough (opcode 60).
inline constexpr std::string_view kParams[] = {
    "feed", "rpm", "clearance", "retract", "depth", "rough_step", "stock_x", "stock_z"};

inline bool is_param(std::string_view name) {
    for (auto p : kParams) if (p == name) return true;
    return false;
}

inline bool is_lathe_rough_param(std::string_view name) {
    return name == "rough_step" || name == "stock_x" || name == "stock_z";
}

// One request file, UTF-8, `key=value` per line:
//   op_id=2          Mastercam operation id (required)
//   param=rough_step one of kParams (required)
//   value=0.4        new value; omit for a read-only run
//   result=C:\...    absolute path for result.json; must not exist yet (required)
struct Request {
    long op_id = 0;
    std::string param;
    std::optional<double> value;
    std::string result;  // UTF-8
};

inline std::string_view trim(std::string_view s) {
    while (!s.empty() && (s.front() == ' ' || s.front() == '\t')) s.remove_prefix(1);
    while (!s.empty() && (s.back() == ' ' || s.back() == '\t' || s.back() == '\r')) s.remove_suffix(1);
    return s;
}

inline Request parse_request(std::string_view text) {
    if (text.size() >= 3 && text.substr(0, 3) == "\xEF\xBB\xBF") text.remove_prefix(3);  // BOM
    Request r;
    bool has_op = false;
    while (!text.empty()) {
        auto end = text.find('\n');
        auto line = trim(text.substr(0, end));
        text = end == std::string_view::npos ? std::string_view{} : text.substr(end + 1);
        if (line.empty() || line.front() == '#') continue;
        auto eq = line.find('=');
        if (eq == std::string_view::npos) throw std::runtime_error("request line without '='");
        auto key = trim(line.substr(0, eq));
        auto val = trim(line.substr(eq + 1));
        if (key == "op_id") {
            auto [p, ec] = std::from_chars(val.data(), val.data() + val.size(), r.op_id);
            if (ec != std::errc{} || p != val.data() + val.size() || r.op_id <= 0)
                throw std::runtime_error("op_id must be a positive integer");
            has_op = true;
        } else if (key == "param") {
            if (!is_param(val)) throw std::runtime_error("unknown param");
            r.param = std::string(val);
        } else if (key == "value") {
            double v = 0;
            auto [p, ec] = std::from_chars(val.data(), val.data() + val.size(), v);
            if (ec != std::errc{} || p != val.data() + val.size() || !std::isfinite(v))
                throw std::runtime_error("value must be a finite number");
            r.value = v;
        } else if (key == "result") {
            if (val.empty()) throw std::runtime_error("result path is empty");
            r.result = std::string(val);
        } else {
            throw std::runtime_error("unknown request key");
        }
    }
    if (!has_op || r.param.empty() || r.result.empty())
        throw std::runtime_error("request needs op_id, param and result");
    return r;
}

inline std::string json_string(std::string_view s) {
    std::string out = "\"";
    for (unsigned char c : s) {
        switch (c) {
            case '"': out += "\\\""; break;
            case '\\': out += "\\\\"; break;
            case '\n': out += "\\n"; break;
            case '\r': out += "\\r"; break;
            case '\t': out += "\\t"; break;
            default:
                if (c < 0x20) {
                    static const char hex[] = "0123456789abcdef";
                    out += "\\u00";
                    out += hex[c >> 4];
                    out += hex[c & 15];
                } else {
                    out += static_cast<char>(c);
                }
        }
    }
    return out + "\"";
}

// Shortest round-trip form, so a readback of 0.4 prints as 0.4, not 0.40000000000000002.
inline std::string json_number(double v) {
    if (!std::isfinite(v)) return "null";
    char buf[32];
    auto [p, ec] = std::to_chars(buf, buf + sizeof buf, v);
    if (ec != std::errc{}) return "null";
    return std::string(buf, p);
}

}  // namespace capp_probe
