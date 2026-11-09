// reflect-ops.csx — dump the Mastercam.Operations API surface relevant to
// lathe parameter editing (S-MC spike). Writes member names to {{RESULT_PATH}}.
using System;
using System.Linq;
string J(string s) {
    return s == null ? "null" : "\"" + s.Replace("\\", "\\\\").Replace("\"", "\\\"")
        .Replace("\r", "\\r").Replace("\n", "\\n").Replace("\t", "\\t") + "\"";
}
var interesting = new System.Text.RegularExpressions.Regex(
    "param|feed|rpm|speed|clearance|retract|depth|step|stock|rough|finish|opcode|regen|nci",
    System.Text.RegularExpressions.RegexOptions.IgnoreCase);
var lines = new System.Collections.Generic.List<string>();
var asm = typeof(Mastercam.Operations.OperationsManager).Assembly;
foreach (var t in asm.GetTypes()) {
    if (t.FullName == null || t.FullName.IndexOf("Operations", System.StringComparison.Ordinal) < 0) continue;
    var members = t.GetMembers(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.Static)
        .Where(m => interesting.IsMatch(m.Name))
        .Select(m => m.MemberType + " " + m.Name)
        .Take(40);
    var list = members.ToArray();
    if (list.Length > 0) lines.Add(t.FullName + " :: " + string.Join(" | ", list));
}
lines.Sort(StringComparer.Ordinal);
System.IO.File.WriteAllLines(@"{{RESULT_PATH}}", lines, new System.Text.UTF8Encoding(false));
