# MOVR

Movr is an accountless way to connect accounts. That means: no password to remember.

## Instructions

### Environment Variables

- LOCALTESTINGENVIRONMENT: set this to T to set the url to http\://localhost/ and make db2 use config/db2creds.json

### The "config" folder

This folder contains a couple of json files needed to authenticate with third-party APIs.

- movrconfig.json:  
  Information for MOVR to use. Contains one value: - url: Full base URL for MOVR. (e.g. https://example.com)
- db2creds.json:  
  MOVR runs on IBM Cloud, and these credentials are credentials used to log into the Db2 on Cloud service.  
  This file is for intended testing environments, in practice you'll want to connect the service to your cloud foundry application.
- db2config.json:  
   **Not to be confused with db2creds.json**, contains one value:
  - tablename: The name of the table used to store movr data
- discordcreds.json  
  Acquired from https://discord.com/developers/applications, contains three values:
  - id: Your discord client ID, - secret: Your discord client secret, - bot: A discord bot token.
- ghclientcreds.json  
  Acquired from https://github.com/settings/developers, contains 3 values: - id: The client ID, - secret: The client secret, - tokenauth: another object containing two values: - username: Your GitHub username, - password: A token from https://github.com/settings/tokens, only needs read:user.
- steamcreds.json  
  Only 1 value: - key: A key acquired from https://steamcommunity.com/dev/apikey
- twitchcreds.json
  Acquired from https://dev.twitch.tv/console/apps, contains two values: - id: Your client ID, - secret: Your client secret.
- twittercreds.json  
  Make sure that 3-legged-OAuth is on!  
  Acquired from https://developer.twitter.com/en/portal/projects, has 3 values: - apikey: Your API Key, - apisecret: Your API Secret, - bearertoken: Your Bearer Token.
