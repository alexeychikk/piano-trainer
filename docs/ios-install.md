# Installing Piano Trainer on your iPad (free, from a Windows PC)

This puts the Piano Trainer app — the one that talks to a MIDI piano plugged into the iPad — on your
own iPad. It costs nothing: no paid Apple developer account and no Mac. You need:

- your iPad and its USB cable;
- a Windows PC;
- an Apple ID (your usual one, or a new free one — see the note in step 3);
- about 30 minutes the first time, and 2 minutes once a week after that.

**The catch:** an app installed this way **stops opening after 7 days**. You then "refresh" it
from the PC (step 8). Your practice history is kept when you refresh.

> Prefer not to install anything? Install **Web MIDI Browser** from the App Store on the iPad and
> open <https://alexeychikk.github.io/piano-trainer/> in it. That works too, without these steps.

---

## 1. Download the app file (on the PC)

1. Open <https://github.com/alexeychikk/piano-trainer/releases/latest>.
   If that page is not an "iPad app" release, open
   <https://github.com/alexeychikk/piano-trainer/releases> and pick the newest release whose title
   starts with **iPad app**.
2. Under **Assets**, click **`piano-trainer.ipa`**. Save it somewhere easy, such as your Downloads
   folder. (It is a single file. Do not unzip it.)

## 2. Install iTunes and iCloud from Apple's website (on the PC)

Sideloadly needs these to talk to the iPad. **The Microsoft Store versions do not work** — get the
ones from Apple's website. If you already have iTunes or iCloud from the Microsoft Store, uninstall
them first (Start → Settings → Apps → find them → Uninstall).

1. Go to <https://www.apple.com/itunes/>, scroll to **"Looking for other versions?"** and choose
   **Windows**, then download **iTunes for Windows (64-bit)**. Install it.
2. Go to <https://support.apple.com/en-us/103232> ("Download iCloud for Windows"). Use the
   direct download link for the version from Apple's website, not the Microsoft Store button, and
   install it. You do **not** need to sign in to iCloud.
3. Restart the PC.

## 3. Install Sideloadly (on the PC)

1. Go to <https://sideloadly.io> and download Sideloadly for Windows. Install and open it.

> **About your Apple ID.** Sideloadly signs the app with your Apple ID: it sends your Apple ID and
> password to Apple (and only to Apple, by its own account) to get a free 7-day certificate. It is a
> free third-party tool, not made by Apple. If you would rather not use your main Apple ID, create a
> new free one at <https://account.apple.com> and use that — it works the same. Either way it must
> have two-factor authentication turned on.

## 4. Connect the iPad (on the PC and the iPad)

1. Plug the iPad into the PC with its USB cable and unlock the iPad.
2. If the iPad asks **"Trust This Computer?"**, tap **Trust** and enter the iPad passcode.
3. In Sideloadly, your iPad's name appears in the **iDevice** box at the top. If it does not,
   unplug and replug the cable, and check iTunes can see the iPad.

## 5. Install the app with Sideloadly (on the PC)

1. Drag `piano-trainer.ipa` onto the big IPA icon in Sideloadly (or click it and choose the file).
2. Type your Apple ID email in the **Apple account** box.
3. Leave the advanced options as they are. In particular, **do not change the bundle ID** —
   your practice history is tied to it.
4. Click **Start**.
5. Enter your Apple ID password when asked, and the six-digit code Apple shows on your other
   devices (or sends by text).
6. Wait until the log at the bottom says **Done**. The Piano Trainer icon appears on the iPad.

If Sideloadly says the iPad needs **Developer Mode**, do step 6 now and then click **Start** again.

## 6. Turn on Developer Mode (on the iPad, once)

1. Open **Settings → Privacy & Security**, scroll to the bottom and tap **Developer Mode**.
   (It only appears after Sideloadly has tried to install the app once — if you do not see it, do
   step 5 first.)
2. Turn it on and tap **Restart**.
3. After the restart, unlock the iPad and tap **Turn On** when asked, then enter your passcode.

## 7. Trust yourself as the developer (on the iPad, once)

The first time you tap the app it says **"Untrusted Developer"**. That is expected.

1. Tap **Cancel**.
2. Open **Settings → General → VPN & Device Management**.
3. Under **Developer App**, tap your Apple ID email, then **Trust "…"**, then **Trust** again.
   (The iPad must be online for this.)
4. Open Piano Trainer. Plug in your piano and press a key — the top bar shows its name.

## 8. Every week: refresh the app

A free Apple ID's install lasts **7 days**. After that the app will not open (your history is still
on the iPad). Before or after it expires:

1. Plug the iPad into the PC and open Sideloadly.
2. Drag the **same** `piano-trainer.ipa` (or a newer one from step 1), use the **same Apple ID**,
   and click **Start**.

That re-installs over the existing app and **keeps your practice history**. You do not need to
repeat steps 6 and 7.

**Automatic refresh (optional).** Sideloadly can refresh by itself over Wi-Fi while the PC is on:

1. In iTunes, with the iPad plugged in, open the iPad's page and tick **Sync with this iPad over
   Wi-Fi** → **Apply**.
2. In Sideloadly, open the advanced options before clicking **Start** and enable **automatic
   refresh** (Sideloadly installs a small helper, the Sideloadly Daemon, that must keep running).
3. Keep the PC on and on the same Wi-Fi as the iPad. If a refresh is ever missed, just do the
   manual refresh above.

## Limits of a free Apple ID

- At most **3 apps** installed this way can be active on the iPad at once (Piano Trainer is one).
- At most **10 new app IDs per week**. Refreshing Piano Trainer does not use a new one; installing
  different apps does. If Sideloadly ever complains about a limit, wait a few days.
- Every install lasts **7 days**, then needs a refresh (step 8).

## Keep a backup of your progress

Your practice history lives inside the app. **Deleting the app deletes it**, and so does installing
it with a different tool (see AltStore below). Now and then, open **Settings → Data → Export JSON** in
the app and save the file (to Files, or send it to yourself). **Import JSON…** on the same screen brings
it back. The website's export file works in the app too, and the other way round.

## If something goes wrong

- **"Untrusted Developer"** — do step 7.
- **The app opens and closes straight away** — it has expired; do step 8.
- **Sideloadly does not see the iPad** — unlock the iPad, re-plug it, tap Trust, and make sure
  iTunes and iCloud are the apple.com versions (step 2).
- **Apple ID login fails** — check the password, that two-factor authentication is on, and enter
  the six-digit code when asked.
- Anything else: write down the last lines of Sideloadly's log and tell the team.

---

## Alternative: AltStore (or SideStore)

AltStore does the same job differently: you install a helper app, **AltStore**, on the iPad once,
and then it installs and refreshes Piano Trainer itself over Wi-Fi while **AltServer** runs on the
PC. Same free Apple ID, same 7-day limit, same 3-app limit (AltStore counts as one of the three).

1. Do step 2 above (iTunes + iCloud from apple.com).
2. Download **AltServer for Windows** from <https://altstore.io>, install it, and follow its guide to
   install AltStore on the iPad (iPad plugged in, AltServer icon in the system tray → **Install
   AltStore** → your Apple ID). Then do steps 6 and 7 above.
3. On the iPad, open the release page from step 1 in Safari and download `piano-trainer.ipa` (it
   goes to the Files app).
4. Open AltStore → **My Apps** → **+** → pick `piano-trainer.ipa`.
5. AltStore refreshes the app on its own when the iPad and the PC (with AltServer running) are on
   the same Wi-Fi.

**SideStore** is a version of AltStore that refreshes on the iPad without the PC after the first
setup; its setup is more technical — see <https://sidestore.io>.

**Pick one tool and stay with it.** AltStore changes the app's ID, so an app installed by AltStore
is a different app from one installed by Sideloadly, with its own (empty) history. Export a backup
before switching, and import it afterwards.

---

*For the team:* how this file is built and published is in
[ADR 0006](decisions/0006-ipad-app-free-sideloading.md). Real-device installation is only ever
verified by the owner.
