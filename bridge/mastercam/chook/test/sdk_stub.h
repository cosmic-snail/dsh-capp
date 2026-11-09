// sdk_stub.h — just enough of the Windows and Mastercam SDK surface to compile param_probe.cpp
// off Windows (CAPP_SDK_STUB). The field names and calls mirror what param_probe.cpp uses; the
// real types come from the SDK. This proves the probe's own logic, not SDK compatibility.
#pragma once
#include <cstdlib>
#include <string>

#define C_H_VERSION 2800
#define MC_NOERROR 0
#define MC_ERROR 1
#ifndef _WIN32
#define __declspec(x)
#endif

using DWORD = unsigned long;
using DB_LIST_ENT_PTR = void *;

enum : short { OPMGR_GET = 1, OPMGR_REWRITE = 2, OPMGR_NCI_FLAG = 3, OPMGR_NCI_REGEN = 4 };

struct operation {
    long op_idn = 0;
    short opcode = 0;
    struct { double feed = 0; long rpm = 0; } tl;
    struct { double clearance_pln = 0; double retract_pln = 0; double depth = 0; } cmn;
    struct { bool nci_flag = false; } db;
    union U { struct { double step; double stock_x; double stock_z; } prm_lrgh; U() : prm_lrgh{} {} } u;
};

// Implemented by the test (fake Mastercam database).
void operation_manager(operation *op, short mode, DB_LIST_ENT_PTR *ptr, bool *ok);

// Only CAPP_CHOOK_REQUEST is ever read; the test sets it with setenv.
inline DWORD GetEnvironmentVariableW(const wchar_t *, wchar_t *buf, DWORD size) {
    const char *v = std::getenv("CAPP_CHOOK_REQUEST");
    if (!v) return 0;
    std::string s(v);
    if (s.size() >= size) return static_cast<DWORD>(s.size() + 1);
    for (size_t i = 0; i < s.size(); ++i) buf[i] = static_cast<wchar_t>(static_cast<unsigned char>(s[i]));
    buf[s.size()] = L'\0';
    return static_cast<DWORD>(s.size());
}
