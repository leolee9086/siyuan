import {readFileSync} from "node:fs";
import {describe, expect, it} from "vitest";

describe("Windows installer executable search-path hardening", () => {
    it("uses trusted system executables and a controlled temporary working directory", () => {
        const source = readFileSync("nsis/installer.nsh", "utf8");

        expect(source).toContain('SetOutPath "$TEMP"');
        expect(source).toContain('nsExec::Exec \'"$SYSDIR\\taskkill.exe" /F /IM "S-Forge.exe"\'');
        expect(source).toContain('nsExec::Exec \'"$SYSDIR\\taskkill.exe" /F /IM "SiYuan-Kernel.exe"\'');
        expect(source).toContain('nsExec::ExecToLog \'"$SYSDIR\\cmd.exe" /c mklink');
        expect(source.match(/"\$SYSDIR\\WindowsPowerShell\\v1\.0\\powershell\.exe"/g)).toHaveLength(4);
        expect(source).not.toContain("nsExec::Exec 'TASKKILL");
        expect(source).not.toContain("nsExec::ExecToLog 'cmd ");
        expect(source).not.toContain("nsExec::ExecToLog 'powershell ");
    });
});
