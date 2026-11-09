// Portable test for probe_request.hpp. From bridge/mastercam/chook:
//   c++ -std=c++20 -Wall -Wextra -I . test/probe_request_test.cpp -o /tmp/probe-request-test && /tmp/probe-request-test
#include "probe_request.hpp"
#include <cassert>
#include <cstdio>

using namespace capp_probe;

static bool throws(std::string_view text) {
    try { parse_request(text); } catch (const std::runtime_error &) { return true; }
    return false;
}

int main() {
    auto r = parse_request("\xEF\xBB\xBF# probe\r\nop_id=2\r\nparam=rough_step\r\nvalue=0.4\r\nresult=C:\\w\\out\\result.json\r\n");
    assert(r.op_id == 2 && r.param == "rough_step" && r.value && *r.value == 0.4);
    assert(r.result == "C:\\w\\out\\result.json");

    auto ro = parse_request("op_id=8\nparam=feed\nresult=C:\\r.json");
    assert(!ro.value);

    assert(throws("param=feed\nresult=x"));                    // no op_id
    assert(throws("op_id=0\nparam=feed\nresult=x"));           // not positive
    assert(throws("op_id=2x\nparam=feed\nresult=x"));          // trailing junk
    assert(throws("op_id=2\nparam=speed\nresult=x"));          // unknown param
    assert(throws("op_id=2\nparam=feed\nvalue=nan\nresult=x")); // not finite
    assert(throws("op_id=2\nparam=feed\nvalue=1,5\nresult=x")); // locale-style decimal
    assert(throws("op_id=2\nparam=feed\nresult=x\nmode=fast")); // unknown key
    assert(throws("op_id=2\nparam=feed"));                     // no result

    assert(is_lathe_rough_param("stock_z") && !is_lathe_rough_param("feed"));
    assert(json_string("a\"b\\c\n\x01") == "\"a\\\"b\\\\c\\n\\u0001\"");
    assert(json_number(0.4) == "0.4" && json_number(1500) == "1500");
    assert(json_number(std::nan("")) == "null");

    std::puts("probe_request: ok");
}
