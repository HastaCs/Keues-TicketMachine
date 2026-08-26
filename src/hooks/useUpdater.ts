import { useCallback, useEffect, useState } from "react";

import {
  checkForUpdates,
  downloadUpdate,
  getAppVersion,
  installUpdate,
  onUpdateState,
} from "../api/appBridge";
import type { UpdateState } from "../types/app";

export function useUpdater() {
  const [version, setVersion] = useState("");
  const [updateState, setUpdateState] = useState<UpdateState | null>(null);

  useEffect(() => {
    void getAppVersion().then((result) => {
      if (result.success && result.version) {
        setVersion(result.version);
      }
    });

    return onUpdateState(setUpdateState);
  }, []);

  const check = useCallback(async () => {
    setUpdateState({ state: "checking" });

    const result = await checkForUpdates();

    if (!result.success) {
      setUpdateState((previous) =>
        previous?.state === "error"
          ? previous
          : {
              state: "error",
              error: result.error ?? "Could not check for updates",
            }
      );
    }
  }, []);

  const download = useCallback(async () => {
    setUpdateState((previous) => ({
      state: "downloading",
      percent: 0,
      version: previous?.version,
    }));

    const result = await downloadUpdate();

    if (!result.success) {
      setUpdateState((previous) =>
        previous?.state === "error"
          ? previous
          : {
              state: "error",
              error: result.error ?? "Could not download the update",
            }
      );
    }
  }, []);

  const install = useCallback(async () => {
    await installUpdate();
  }, []);

  const reset = useCallback(() => {
    setUpdateState(null);
  }, []);

  return {
    version,
    updateState,
    checkForUpdates: check,
    downloadUpdate: download,
    installUpdate: install,
    resetUpdateState: reset,
  };
}
