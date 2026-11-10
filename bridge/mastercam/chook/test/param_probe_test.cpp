// Drives m_main against a fake operation database (test/sdk_stub.h). From bridge/mastercam/chook:
//   c++ -std=c++20 -Wall -Wextra -DCAPP_SDK_STUB -I . param_probe.cpp test/param_probe_test.cpp -o /tmp/param-probe-test && /tmp/param-probe-test
// Proves the probe's flow and result.json, not the real SDK.
#include "test/sdk_stub.h"
#include <cassert>
#include <cstdio>
#include <filesystem>
#include <fstream>
#include <map>
#include <sstream>
#include <string>

extern "C" int m_main(int);

namespace fs = std::filesystem;

static std::map<long, operation> db;
static bool fail_regen = false;

void operation_manager(operation *op, short mode, DB_LIST_ENT_PTR *, bool *ok) {
    auto it = db.find(op->op_idn);
    *ok = it != db.end();
    if (!*ok) return;
    switch (mode) {
        case OPMGR_GET: *op = it->second; break;
        case OPMGR_REWRITE: it->second = *op; break;
        case OPMGR_NCI_FLAG: it->second.db.nci_flag = true; break;
        case OPMGR_NCI_REGEN: if (fail_regen) *ok = false; else it->second.db.nci_flag = false; break;
        default: *ok = false;
    }
}

static fs::path dir;
static int n = 0;

static std::string run(const std::string &request, int expect_code) {
    auto req = dir / ("req" + std::to_string(++n) + ".txt");
    auto res = dir / ("res" + std::to_string(n) + ".json");
    std::ofstream(req) << request << "result=" << res.string() << "\n";
    setenv("CAPP_CHOOK_REQUEST", req.c_str(), 1);
    const int code = m_main(0);
    assert(code == expect_code);
    if (!fs::exists(res)) return "";
    std::stringstream ss;
    ss << std::ifstream(res).rdbuf();
    return ss.str();
}

static bool has(const std::string &s, const char *part) { return s.find(part) != std::string::npos; }

int main() {
    dir = fs::temp_directory_path() / "capp-param-probe-test";
    fs::remove_all(dir);
    fs::create_directories(dir);

    operation rough;
    rough.op_idn = 2; rough.opcode = 60; rough.tl.feed = 0.25; rough.tl.rpm = 1200;
    rough.u.prm_lrgh.step = 0.5;
    db[2] = rough;
    operation face;
    face.op_idn = 1; face.opcode = 66; face.tl.feed = 0.1;
    db[1] = face;

    // Write, regen, readback on lathe rough.
    auto r = run("op_id=2\nparam=rough_step\nvalue=0.4\n", MC_NOERROR);
    assert(has(r, "\"ok\":true") && has(r, "\"opcode\":60"));
    assert(has(r, "\"before\":{\"feed\":0.25,\"rpm\":1200,\"clearance\":0,\"retract\":0,\"depth\":0,\"rough_step\":0.5"));
    assert(has(r, "\"dirty_after_flag\":true") && has(r, "\"dirty_after_regen\":false"));
    assert(has(r, "\"rough_step\":0.4") && has(r, "\"steps\":[\"read\",\"rewrite\",\"readback\",\"flag\",\"regen\"]"));
    assert(db[2].u.prm_lrgh.step == 0.4);

    // Read-only run.
    r = run("op_id=1\nparam=feed\n", MC_NOERROR);
    assert(has(r, "\"ok\":true") && has(r, "\"steps\":[\"read\"]") && !has(r, "rough_step"));

    // rpm rounds to the integral field and still matches.
    r = run("op_id=2\nparam=rpm\nvalue=1500.4\n", MC_NOERROR);
    assert(has(r, "\"ok\":true") && db[2].tl.rpm == 1500);

    // Lathe-rough-only param on another opcode: result says why, nothing written.
    r = run("op_id=1\nparam=rough_step\nvalue=0.4\n", MC_NOERROR);
    assert(has(r, "\"ok\":false") && has(r, "opcode 60"));

    // Regen failure is reported with how far it got.
    fail_regen = true;
    r = run("op_id=2\nparam=feed\nvalue=0.3\n", MC_NOERROR);
    assert(has(r, "\"ok\":false") && has(r, "OPMGR_NCI_REGEN failed") && has(r, "\"flag\"]"));
    fail_regen = false;

    // Unknown operation.
    r = run("op_id=99\nparam=feed\n", MC_NOERROR);
    assert(has(r, "\"ok\":false") && has(r, "OPMGR_GET failed"));

    // Bad request: nowhere trustworthy to write, so MC_ERROR and no file.
    assert(run("op_id=2\nparam=speed\n", MC_ERROR).empty());

    // Never overwrite an earlier result.
    auto req = dir / "again.txt";
    auto res = dir / "res1.json";
    std::ofstream(req) << "op_id=2\nparam=feed\nresult=" << res.string() << "\n";
    setenv("CAPP_CHOOK_REQUEST", req.c_str(), 1);
    assert(m_main(0) == MC_ERROR);

    unsetenv("CAPP_CHOOK_REQUEST");
    assert(m_main(0) == MC_ERROR);

    fs::remove_all(dir);
    std::puts("param_probe: ok");
}
