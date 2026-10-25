/** Doctor version check: report the exact local Bunraku and Bun builds without making network egress. */
import type { DoctorCheck } from "../check";

const check: DoctorCheck = {
  id: "version",
  label: "Version",
  async run(context) {
    return {
      status: "ok",
      detail: `Bunraku ${context.version} · Bun ${context.runtime}`,
    };
  },
};

export default check;
