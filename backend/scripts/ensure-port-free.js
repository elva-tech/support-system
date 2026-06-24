const { execSync } = require("child_process");

const port = String(process.argv[2] || process.env.PORT || 3000);

const killOnWindows = () => {
  let output = "";

  try {
    output = execSync(`netstat -ano | findstr :${port}`, { encoding: "utf8" });
  } catch {
    return;
  }

  const pids = [
    ...new Set(
      output
        .split(/\r?\n/)
        .filter((line) => line.includes("LISTENING"))
        .map((line) => line.trim().split(/\s+/).pop())
        .filter((pid) => pid && pid !== "0")
    )
  ];

  const currentPid = String(process.pid);

  for (const pid of pids) {
    if (pid === currentPid) {
      continue;
    }

    try {
      execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
      console.log(`Freed port ${port} (stopped PID ${pid})`);
    } catch {
      // Process may have already exited.
    }
  }
};

const killOnUnix = () => {
  try {
    execSync(`lsof -ti tcp:${port} | xargs -r kill -9`, {
      stdio: "ignore",
      shell: true
    });
  } catch {
    // Port already free.
  }
};

if (process.platform === "win32") {
  killOnWindows();
} else {
  killOnUnix();
}
