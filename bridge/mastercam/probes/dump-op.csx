// dump-op.csx — dump every .NET-reachable parameter of one operation (S-MC spike).
// {{OP_ID}} = Mastercam operation id; {{RESULT_PATH}} = JSON output.
using System;
using System.Globalization;
using System.IO;
using System.Reflection;
using System.Text;
string J(string s) {
    return s == null ? "null" : "\"" + s.Replace("\\", "\\\\").Replace("\"", "\\\"")
        .Replace("\r", "\\r").Replace("\n", "\\n").Replace("\t", "\\t") + "\"";
}
string N(object v) {
    if (v == null) return "null";
    try { return Convert.ToDouble(v).ToString("R", CultureInfo.InvariantCulture); }
    catch { return J(v.ToString()); }
}
int opId = int.Parse(@"{{OP_ID}}");
Mastercam.Database.Operation op = null;
try { op = Mastercam.Support.SearchManager.GetOperation(opId); } catch {}
if (op == null) {
    try { op = Mastercam.Support.Typecaster.OperationCaster(opId); } catch {}
}
if (op == null) {
    foreach (var cand in Mastercam.Support.SearchManager.GetOperations()) {
        try {
            if (cand != null && cand.GetOperationID() == opId) { op = cand; break; }
        } catch {}
    }
}
if (op == null) {
    File.WriteAllText(@"{{RESULT_PATH}}", "{\"error\":\"no operation matched id \"}", new UTF8Encoding(false));
    return;
}
var sb = new StringBuilder();
sb.Append("{\"id\":").Append(opId)
  .Append(",\"type\":").Append(J(op.Type.ToString()))
  .Append(",\"feedRate\":").Append(N(op.FeedRate))
  .Append(",\"spindleSpeed\":").Append(N(op.SpindleSpeed))
  .Append(",\"plungeRate\":").Append(N(op.PlungeRate))
  .Append(",\"retractRate\":").Append(N(op.RetractRate))
  .Append(",\"name\":").Append(J(op.Name))
  .Append(",\"nciName\":").Append(J(op.NCIName));
var lk = op.Linking;
if (lk != null) {
    sb.Append(",\"linking\":{");
    var first = true;
    foreach (var p in lk.GetType().GetProperties(BindingFlags.Public | BindingFlags.Instance)) {
        var pt = p.PropertyType;
        if (pt != typeof(double) && pt != typeof(int) && pt != typeof(bool)) continue;
        if (!first) sb.Append(',');
        first = false;
        sb.Append(J(p.Name)).Append(':');
        try { sb.Append(N(p.GetValue(lk))); } catch { sb.Append("null"); }
    }
    sb.Append('}');
}
var mv = op.MiscValues;
if (mv != null) {
    sb.Append(",\"miscReals\":[");
    for (int i = 0; i < 10; i++) {
        if (i > 0) sb.Append(',');
        try { sb.Append(N(mv.Reals[i])); } catch { sb.Append("null"); }
    }
    sb.Append("],\"miscIntegers\":[");
    for (int i = 0; i < 10; i++) {
        if (i > 0) sb.Append(',');
        try { sb.Append(mv.Integers[i]); } catch { sb.Append("null"); }
    }
    sb.Append(']');
}
sb.Append('}');
File.WriteAllText(@"{{RESULT_PATH}}", sb.ToString(), new UTF8Encoding(false));
