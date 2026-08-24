# Keues TicketMachine 🎫

[![Version](https://img.shields.io/badge/dynamic/json?url=https://raw.githubusercontent.com/HastaCs/Keues-TicketMachine/main/package.json&query=$.version&label=Version&color=blue)](https://github.com/HastaCs/Keues-TicketMachine)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

**Versión en español disponible:** [README.md](README.md)

Keues TicketMachine is the **physical self-service kiosk** of the **Keues** queue management system. It is the machine the customer uses to pick a service and get their turn number, which is printed instantly.

Official website and documentation: **[https://www.keues.dev](https://www.keues.dev)**

> ⚠️ **Important:** the machine does not work standalone. It needs a server to connect to and issue tickets (see [Requirements](#requirements-)).

---

## 🖥️ For the customer

Using the machine is very simple:

1. The screen shows the **service menu** of the establishment.
2. The customer taps the service they need (if there are submenus, they navigate with the **"Back"** button).
3. The machine generates their **turn number** and shows it on screen.
4. The ticket is **printed** automatically.
5. After 2 seconds the screen returns to the main menu, ready for the next customer.

---

## 🏪 For the business

### Requirements ⚠️

- A **Keues server** ([Keues](https://github.com/HastaCs/Keues)) deployed and reachable from the same network as the machine. The server manages the queues, tickets and service flows; without it the machine cannot issue tickets.
- A **screen** (ideally touch) for the kiosk.
- A **ticket printer** (thermal POS or any system printer).

### Installation ⬇️

You do not need to build anything. Every [GitHub release](https://github.com/HastaCs/Keues-TicketMachine/releases) includes a ready-to-install `.exe` for Windows:

1. Download the `Keues-TicketMachine-Setup-X.Y.Z.exe` file.
2. Run it and follow the installer steps.
3. The machine is installed and ready to configure.

### Initial setup ⚙️

When you open the app for the first time, the **machine settings** screen is shown:

1. Enter the **server address** of your Keues server and press **Connect**.
2. Select the **location** (establishment).
3. Select the **flow** of services.
4. Assign a **machine name**.
5. Choose the **visual theme** (optional).

Save the settings and the machine will load the service menu and start serving customers.

### Printer 🖨️

Printing can be configured from the settings:

- **Printer picker**: choose among the available printers.
- **Paper size**: 58 mm or 80 mm.
- **Print preview**: review how the ticket will look before printing.

### Visual customization 🎨

**Buttons, backgrounds and texts are configurable.** From the settings you can change:

- Header and button colors.
- Button corner radius.
- On-screen title.
- Background image.
- Number of menu columns.

### Updates 🔄

The machine can update itself. From **Settings → Updates** you can check for a newer version on GitHub, download it and install it with one click; the app restarts into the updated version.

> ℹ️ The update check is only available in the installed app.

### FAQ ❓

**Does the machine work without a server?**
No. It needs a Keues server deployed and reachable from the same network as the machine.

**Which printer do I need?**
A thermal POS printer (58/80 mm) or any system printer. It is selected from the settings.

**Can I change the colors and texts?**
Yes. Buttons, backgrounds and texts are configurable from the machine settings.

**How does the machine update?**
From **Settings → Updates** you can check, download and install the latest version with one click.

---

## License

Released under the [MIT License](LICENSE).
