// param_probe.cpp — the smallest CHook that answers S-MC's main question:
// can one lathe operation parameter be written, regenerated and read back?
//
// Flow (one operation, one parameter, one run):
//   OPMGR_GET -> read all applicable params -> set one -> OPMGR_REWRITE -> OPMGR_GET (readback)
//   -> OPMGR_NCI_FLAG -> OPMGR_GET (dirty must be true) -> OPMGR_NCI_REGEN -> OPMGR_GET
//   (dirty must be false, value unchanged) -> result.json.
// Without `value` in the request, it only reads (and still writes result.json).
//
// Input: the C# caller (probes/chook-param.csx) sets the process environment variable
// CAPP_CHOOK_REQUEST to a request file (format in probe_request.hpp) before RunCHook.
// It's read with GetEnvironmentVariableW: the CRT's _wgetenv copy doesn't see values .NET sets
// later through SetEnvironmentVariable.
// Output: result.json at the request's `result` path. An existing file is never overwritten;
// each run uses a fresh directory (design principle 2).
// m_main returns MC_NOERROR when result.json was written, whether the probe succeeded or not;
// `ok` in result.json carries the outcome. MC_ERROR means no result could be written.
//
// SDK calls were learned from CAPPtron-core's native bridge (reference only, not copied).
// Header set is the first-compile guess for the Mastercam 2026 SDK (C_H_VERSION 2800); the
// README says how to adjust it if the first build reports a missing declaration.

#include "probe_request.hpp"

#include <algorithm>
#include <cmath>
#include <filesystem>
#include <fstream>
#include <memory>
#include <sstream>
#include <string>
#include <vector>

#ifdef CAPP_SDK_STUB
#include "test/sdk_stub.h"
#else
#include <afxwin.h>
#include <Windows.h>
#include <interfaces/Core/3DVarsDefines_CH.h>
#include <interfaces/GUI/usermsgs_ch.h>
#include "BaseOperationTypes_CH.h"
// Entity_CH.h uses MFC's CArray without including afxtempl.h.
template <class TYPE, class ARG_TYPE> class CArray;
#include "Entity_CH.h"
static_assert(C_H_VERSION == 2800, "param_probe targets the Mastercam 2026 SDK only");
#endif

namespace {

using capp_probe::json_number;
using capp_probe::json_string;

constexpr int kLatheRoughOpcode = 60;

bool same(double a, double b) {
    const double scale = std::max(1.0, std::max(std::fabs(a), std::fabs(b)));
    return std::fabs(a - b) <= 1e-9 * scale;
}

std::unique_ptr<operation> get_op(long id) {
    auto op = std::make_unique<operation>();
    op->op_idn = id;
    DB_LIST_ENT_PTR ptr = nullptr;
    bool ok = false;
    operation_manager(op.get(), OPMGR_GET, &ptr, &ok);
    if (!ok || op->op_idn != id) throw std::runtime_error("OPMGR_GET failed for the operation id");
    return op;
}

void call(operation &op, short mode, const char *what) {
    DB_LIST_ENT_PTR ptr = nullptr;
    bool ok = false;
    operation_manager(&op, mode, &ptr, &ok);
    if (!ok) throw std::runtime_error(what);
}

bool applies(const operation &op, const std::string &name) {
    return !capp_probe::is_lathe_rough_param(name) || static_cast<int>(op.opcode) == kLatheRoughOpcode;
}

double read_param(const operation &op, const std::string &name) {
    if (name == "feed") return op.tl.feed;
    if (name == "rpm") return static_cast<double>(op.tl.rpm);
    if (name == "clearance") return op.cmn.clearance_pln;
    if (name == "retract") return op.cmn.retract_pln;
    if (name == "depth") return op.cmn.depth;
    if (name == "rough_step") return op.u.prm_lrgh.step;
    if (name == "stock_x") return op.u.prm_lrgh.stock_x;
    if (name == "stock_z") return op.u.prm_lrgh.stock_z;
    throw std::runtime_error("unknown param");
}

void write_param(operation &op, const std::string &name, double v) {
    if (name == "feed") op.tl.feed = v;
    else if (name == "rpm") op.tl.rpm = static_cast<decltype(op.tl.rpm)>(v + (v < 0 ? -0.5 : 0.5));
    else if (name == "clearance") op.cmn.clearance_pln = v;
    else if (name == "retract") op.cmn.retract_pln = v;
    else if (name == "depth") op.cmn.depth = v;
    else if (name == "rough_step") op.u.prm_lrgh.step = v;
    else if (name == "stock_x") op.u.prm_lrgh.stock_x = v;
    else if (name == "stock_z") op.u.prm_lrgh.stock_z = v;
    else throw std::runtime_error("unknown param");
}

// {"feed":…,"rpm":…} for every parameter this operation type has.
std::string snapshot(const operation &op) {
    std::string out = "{";
    for (auto p : capp_probe::kParams) {
        std::string name(p);
        if (!applies(op, name)) continue;
        if (out.size() > 1) out += ',';
        out += json_string(name) + ':' + json_number(read_param(op, name));
    }
    return out + '}';
}

struct Result {
    std::vector<std::string> fields;  // "key":value pairs, in order
    std::vector<std::string> steps;   // completed steps, for "how far did it get"
    std::string error;
    bool ok = false;
    void add(const std::string &key, const std::string &json) { fields.push_back(json_string(key) + ':' + json); }
    std::string text() const {
        std::string s = "{\"ok\":";
        s += ok ? "true" : "false";
        s += ",\"error\":" + (error.empty() ? std::string("null") : json_string(error));
        for (const auto &f : fields) s += ',' + f;
        s += ",\"steps\":[";
        for (size_t i = 0; i < steps.size(); ++i) s += (i ? "," : "") + json_string(steps[i]);
        return s + "]}";
    }
};

void run(const capp_probe::Request &req, Result &r) {
    r.add("op_id", std::to_string(req.op_id));
    r.add("param", json_string(req.param));
    r.add("requested", req.value ? json_number(*req.value) : "null");

    auto op = get_op(req.op_id);
    r.add("opcode", std::to_string(static_cast<int>(op->opcode)));
    r.add("before", snapshot(*op));
    r.add("dirty_before", op->db.nci_flag ? "true" : "false");
    r.steps.push_back("read");
    if (!applies(*op, req.param))
        throw std::runtime_error("param exists only on lathe rough (opcode 60)");
    if (!req.value) { r.ok = true; return; }

    // Expected value after the field's own type conversion (rpm is integral).
    auto expected_op = std::make_unique<operation>(*op);
    write_param(*expected_op, req.param, *req.value);
    const double expected = read_param(*expected_op, req.param);

    write_param(*op, req.param, *req.value);
    call(*op, OPMGR_REWRITE, "OPMGR_REWRITE failed");
    r.steps.push_back("rewrite");
    op = get_op(req.op_id);
    const double written = read_param(*op, req.param);
    r.add("after_rewrite", snapshot(*op));
    if (!same(written, expected))
        throw std::runtime_error("readback after OPMGR_REWRITE differs from the requested value");
    r.steps.push_back("readback");

    call(*op, OPMGR_NCI_FLAG, "OPMGR_NCI_FLAG failed");
    op = get_op(req.op_id);
    r.add("dirty_after_flag", op->db.nci_flag ? "true" : "false");
    if (!op->db.nci_flag) throw std::runtime_error("operation not dirty after OPMGR_NCI_FLAG");
    r.steps.push_back("flag");

    call(*op, OPMGR_NCI_REGEN, "OPMGR_NCI_REGEN failed");
    op = get_op(req.op_id);
    r.add("dirty_after_regen", op->db.nci_flag ? "true" : "false");
    r.add("after_regen", snapshot(*op));
    if (op->db.nci_flag) throw std::runtime_error("toolpath still dirty after OPMGR_NCI_REGEN");
    if (!same(read_param(*op, req.param), written)) throw std::runtime_error("value changed during regeneration");
    r.steps.push_back("regen");
    r.ok = true;
}

std::filesystem::path utf8_path(const std::string &s) {
    return std::filesystem::path(std::u8string(s.begin(), s.end()));
}

std::string read_file(const std::filesystem::path &p) {
    std::ifstream in(p, std::ios::binary);
    if (!in) throw std::runtime_error("cannot open request file");
    std::ostringstream ss;
    ss << in.rdbuf();
    return ss.str();
}

std::wstring request_path() {
    wchar_t buf[1024];
    const DWORD n = GetEnvironmentVariableW(L"CAPP_CHOOK_REQUEST", buf, 1024);
    if (n == 0 || n >= 1024) throw std::runtime_error("CAPP_CHOOK_REQUEST is not set");
    return std::wstring(buf, n);
}

bool write_new(const std::filesystem::path &p, const std::string &text) {
    std::error_code ec;
    if (std::filesystem::exists(p, ec)) return false;  // never overwrite an earlier run's result
    std::ofstream out(p, std::ios::binary);
    out << text;
    out.close();
    return static_cast<bool>(out);
}

}  // namespace

extern "C" __declspec(dllexport) int m_version(int /*host_version*/) {
    return C_H_VERSION;
}

extern "C" __declspec(dllexport) int m_main(int /*unused*/) {
    capp_probe::Request req;
    try {
        req = capp_probe::parse_request(read_file(std::filesystem::path(request_path())));
    } catch (...) {
        return MC_ERROR;  // no trustworthy place to write a result
    }
    Result r;
    try {
        run(req, r);
    } catch (const std::exception &e) {
        r.ok = false;
        r.error = e.what();
    } catch (...) {
        r.ok = false;
        r.error = "unknown exception";
    }
    try {
        return write_new(utf8_path(req.result), r.text()) ? MC_NOERROR : MC_ERROR;
    } catch (...) {
        return MC_ERROR;
    }
}
