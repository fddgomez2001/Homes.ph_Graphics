document.getElementById("panel-css").textContent = HP.PANEL_CSS
HP.mountPanel(document.getElementById("root"), { onStarted: () => window.close() })
