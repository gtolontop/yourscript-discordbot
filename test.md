# Testing Guide: New Bot Features

This document provides a step-by-step guide to testing the latest features added to the bot. Since many of these features interact with Discord, the Database, and external APIs (like GitHub or Tebex), testing them requires a few specific steps.

---

## 🛡️ 1. Anti-Scam & Moderation Features

### 🎣 Automated Phishing & Scam Detection
1. Open any public text channel in your server where the bot has read/manage message permissions.
2. Send a fake scam link mimicking a classic Discord nitro or steam scam. For example:
   `Hey guys, get free Discord Nitro here: http://discord.gift/fake123` or `Check out my steamcommunity-xyz link`
3. **Expected Result**: 
   - The bot should instantly delete your message.
   - You (the sender) should receive a Direct Message from the bot saying: "⚠️ Your message was deleted by the Anti-Scam filter."
   *(Note: Ensure you are testing this with an account that is NOT an Administrator/Staff member, as staff bypass the filter).*

### 🚪 Anti-Raid Mode & Alt-Account Flagging
*Since Anti-Raid kicks users instantly and Alt-flagging checks account age, testing requires you to manipulate the database settings or use a test account.*
1. **Enable Anti-Raid**: Go into your database (via Prisma Studio) and set `antiRaidEnabled` to `true` for your Guild.
2. **Invite a Test Account**: Invite a second account to your server.
3. **Expected Result**: The test account should be instantly kicked upon joining, and the bot will log it in its console.
4. **Test Alt-Flagging**: Set `altFlaggingEnabled` to `true` and ensure `modLogsChannel` is configured. Join with a brand new account (created < 24h ago) or an account with no profile picture. The bot should send a "⚠️ Suspicious Account Joined" embed in your Mod Logs channel.

---

## 🎙️ 2. Temporary Voice Channels (VoiceMaster)

1. **Setup**: The bot requires the Guild to have `voiceMasterChannelId` configured in the database. (e.g., Set up a voice channel named "➕ Create Private Room").
2. **Action**: Join the "➕ Create Private Room" voice channel.
3. **Expected Result**:
   - The bot will instantly move you out of the creation channel.
   - It will create a new voice channel named `🔊 [Your Username]'s Room`.
   - You will automatically be granted Manage Channels permissions for this specific sub-channel.
4. **Cleanup**: Leave your new Private Room.
   - **Expected Result**: Once empty, the bot will automatically delete the temporary channel and clean it from the database.

---

## 🎉 3. Advanced Giveaways (Requirements)

1. **Start a Giveaway**: Type `/giveaway start` in any channel.
2. Fill in the required parameters (Price: "Tebex Script", Duration: "5m", Winners: 1).
3. Fill in the **OPTIONAL** advanced constraints:
   - `role`: Pick a random role.
   - `required_level`: Try setting it to `Level 5`.
   - `required_voice`: Pick a specific voice channel.
4. **Test Entry**: Have an account (or yourself) click the "Enter" button on the Giveaway embed.
5. **Expected Result**: 
   - If the account doesn't meet the level, role, or voice channel requirement, the bot will give an ephemeral error message explaining exactly why they can't join.
   - If all requirements are met, they will join successfully.

---

## 🚀 4. XP, Leveling & Auto-Roles

1. **Send Messages**: Talk in any text channel.
2. **Expected Result**:
   - Behind the scenes, the bot assigns random XP (between 15 and 25 by default) per message, with a 60-second cooldown per user.
   - Check your database (`User` table) to see your `xp` and `level` increasing.
3. **Level Up Announcement**: Ensure `levelUpChannel` and `levelUpMessage` are configured in your Guild DB. Once you hit the XP threshold for Level 1 (or 2, etc.), the bot will announce it publicly in that channel.
4. *(Optional)* **Level Roles**: If you added a `LevelRole` entry in your database (e.g., Level 5 = Role X), the bot will instantly give you that Discord Role upon reaching the level.

---

## 🎫 5. GitHub Issue Export

1. **Action**: Create a new mock Ticket via your Ticket Panel (e.g., a "Bug Report").
2. **Command**: In the ticket channel, type `/github export repo:owner/repo`. (Use a repo you don't mind dropping a test issue in, like `gtolontop/yorkdev-bot`).
3. **Expected Result**:
   - The bot will generate a clickable GitHub link specifically formatted to create a new Issue using the Ticket's Subject.
   *(Currently, it outputs the draft URL for a human to click and submit. With a GitHub Token configured later, this will auto-post directly via API).*
