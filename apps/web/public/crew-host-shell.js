const status = document.getElementById("status");
const frame = document.getElementById("crew");
let expires = 0;
let renewing = false;
const response = await fetch("/api/auth/host-session/config", {
  cache: "no-store",
});
if (!response.ok) throw new Error("Crew access unavailable");
const { origin } = await response.json();
if (window.parent === window) {
  status.textContent = "Accede desde tu sesión de Manfacter Admin. ";
  const link = document.createElement("a");
  link.href = `${origin}/agents-test`;
  link.textContent = "Abrir Manfacter Crew";
  status.append(link);
}
function close() {
  expires = 0;
  frame.hidden = true;
  frame.removeAttribute("src");
  status.hidden = false;
  status.textContent = "Abre Manfacter Crew desde tu sesión de Admin.";
  void fetch("/api/auth/sign-out", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
}
window.addEventListener("message", async (event) => {
  if (event.source !== window.parent || event.origin !== origin) return;
  if (event.data?.type === "crew:close") {
    close();
    return;
  }
  if (
    event.data?.type !== "crew:session" ||
    renewing ||
    typeof event.data.assertion !== "string" ||
    event.data.assertion.length > 2048
  )
    return;
  renewing = true;
  try {
    const result = await fetch("/api/auth/host-session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ assertion: event.data.assertion }),
    });
    if (!result.ok) throw new Error("Host session rejected");
    const session = await result.json();
    expires = Date.parse(session.expiresAt);
    if (!Number.isFinite(expires)) throw new Error("Invalid host lease");
    if (!frame.hasAttribute("src")) frame.src = "/app";
    frame.hidden = false;
    status.hidden = true;
  } catch {
    close();
  } finally {
    renewing = false;
  }
});
setInterval(() => {
  if (expires && expires <= Date.now()) close();
}, 1000);
window.parent.postMessage({ type: "crew:ready" }, origin);
