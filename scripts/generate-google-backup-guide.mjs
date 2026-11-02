import { readFile, mkdir, writeFile } from "node:fs/promises";

const source = await readFile(new URL("../artifacts/chainsaw-training/public/docs/google-backup-trigger.gs", import.meta.url), "utf8");
const escape = (text) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const html = `<!doctype html><html lang="en-GB"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Google daily backup setup — Chainsaw Courses</title>
<style>
*{box-sizing:border-box}body{font:16px/1.6 system-ui,sans-serif;margin:0;background:#f4f5f4;color:#18221d}main{max-width:860px;margin:auto;padding:32px 20px}
h1{line-height:1.2}section{background:white;padding:22px;margin:18px 0;border:1px solid #d8dfda;border-radius:8px}button{background:#23563d;color:white;border:0;border-radius:5px;padding:12px 18px;font:inherit;cursor:pointer}
button:focus-visible,a:focus-visible{outline:3px solid #d47a22;outline-offset:3px}textarea,input{width:100%;font:14px/1.5 ui-monospace,monospace;border:1px solid #aaa;padding:12px;margin:10px 0}textarea{height:330px}code{overflow-wrap:anywhere}
.note{border-left:4px solid #d47a22;padding-left:15px}li{margin:10px 0}.status{min-height:1.5em;font-weight:600}
</style><main>
<h1>Set up the daily Google backup trigger</h1>
<p>One-time setup for <strong>app.chainsawcourses.com</strong>. Google checks every 15 minutes, starting from 06:00 UK time, and wakes the live app to run the backup. GMT/BST is handled automatically. Google timing and service availability can delay a run; 06:00 exactly is not guaranteed.</p>
<section><h2>1. Create a dedicated trigger key</h2>
<p>Generate the key here, then copy it to both places below. It is generated only in your browser, is not sent anywhere by this guide, and disappears when you close or reload this page.</p>
<button id="generate">Generate secure key</button>
<label for="key">Dedicated key</label><input id="key" type="password" readonly autocomplete="off">
<button id="copykey">Copy key</button><p id="key-status" class="status" role="status"></p>
<ul><li>In Replit, save it as the secret <code>BACKUP_TRIGGER_SECRET</code> using the secure form in chat or Tools → Secrets. It must be available to the <strong>Production</strong> deployment.</li>
<li>Keep it ready to paste into Google's Script properties in step 3. Never paste the key into chat or into the script code.</li></ul>
<p class="note">This is NOT your admin password or <code>MIGRATION_BACKUP_PASSPHRASE</code>. Your archive passphrase remains in Replit and is never given to Google.</p></section>
<section><h2>2. Publish the app update</h2><p>Publish after the new trigger key has been saved. This activates the protected backup endpoint. Leave the existing website on Autoscale; a separate Replit Scheduled Deployment is not needed for this Google approach.</p></section>
<section><h2>3. Install the script in your Google account</h2>
<ol><li>Open <a href="https://script.google.com/home/start" target="_blank" rel="noopener noreferrer">Google Apps Script</a>, choose <strong>New project</strong> and name it <strong>Chainsaw daily backup</strong>. Use the Google account you want to own the automation.</li>
<li>Replace the contents of <strong>Code.gs</strong> with the script below and save.</li>
<li>Open <strong>Project settings → Script properties → Add script property</strong>. Name: <code>BACKUP_TRIGGER_SECRET</code>. Value: the same key from step 1. Save it. Keep the script project private.</li>
<li>Return to the editor, select <strong>installBackupTrigger</strong> in the function dropdown, then click <strong>Run</strong>. Review and approve the requested permissions. The script needs external web requests and management of its own triggers—not Gmail messages or Drive files. Google may show an unverified-app warning for your own script; check the project and code before proceeding, and stop if your organisation blocks it.</li>
<li>The execution log must say <strong>Connection ready</strong> and then <strong>Installed</strong>. If it reports 401, check that the two keys match. If 404, publish the updated app. If 503, check that the trigger key and 16+ character archive passphrase are available in Production Secrets, then publish.</li></ol>
<button id="copyscript">Copy complete script</button><p id="script-status" class="status" role="status"></p>
<label for="script">Code.gs</label><textarea id="script" readonly spellcheck="false">${escape(source)}</textarea></section>
<section><h2>Confirm it is working</h2>
<p>The install function checks connectivity without creating a backup. To test a real backup after 06:00 UK, select <code>runDailyBackup</code> and click Run. Otherwise leave it for the next eligible automatic check. Check <strong>Admin → Data &amp; Backup</strong> for running/completed/failed status and the verified Drive file links. Until you see that confirmation, a backup has not been proven.</p>
<p>There are no weekly backup reminders or start/completion emails. Existing backup-failure alerts and quarterly restoration-test reminders remain. Network failures are retried on the next check. A recorded failed daily backup is shown in admin and requires review/retry there; the trigger does not repeatedly create new runs for the same day.</p>
<p>Google Apps Script has execution and daily quotas. A long request can time out; that does not prove success or failure. The next check asks the server again; always use the admin record to confirm completion. Disabling the Google account, deleting its script/trigger, or revoking permissions stops this automation.</p>
<p><strong>Backup coverage:</strong> one full encrypted database archive plus five encrypted category archives. Document PDFs are regenerated, not original issued files. Database reads are not a single point-in-time snapshot. Uploaded App Storage files, Firebase media and other external files remain excluded. Archive files need your separately held passphrase to decrypt.</p>
<p>To stop this automation, run <code>removeBackupTrigger</code>. To rotate the key, update both Replit Production Secrets and Google Script properties, then republish.</p></section></main>
<script>
const status=(id,text)=>document.getElementById(id).textContent=text;
document.getElementById('generate').onclick=()=>{const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);document.getElementById('key').value=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');status('key-status','Key generated locally. Copy it to Replit and Google before closing this guide.');};
async function copy(id,target){const field=document.getElementById(id);if(!field.value){status(target,'Generate the key first.');return;}try{await navigator.clipboard.writeText(field.value);status(target,'Copied.');}catch{field.focus();field.select();status(target,'Selected. Use your device’s Copy command.');}}
document.getElementById('copykey').onclick=()=>copy('key','key-status');
document.getElementById('copyscript').onclick=()=>copy('script','script-status');
</script></html>`;
await mkdir(new URL("../generated-artifacts/backups/", import.meta.url), { recursive: true });
await writeFile(new URL("../generated-artifacts/backups/google-backup-setup.html", import.meta.url), html);
console.log("Created generated-artifacts/backups/google-backup-setup.html (no credentials embedded).");
