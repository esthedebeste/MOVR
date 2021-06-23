const movrdata = document.getElementById("movrdata").dataset;
const path = location.pathname.split("/").filter(a => a);
const from = path[0];
const name = path[1];
const userid = parseInt(movrdata.userid);
const ids = JSON.parse(movrdata.ids);
const predata = JSON.parse(movrdata.predata);
const logos = {
  GITHUB_ID: `<svg class="logo" alt="GitHub Logo" align="left" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path></svg>`,
  DISCORD_ID: `<svg class="logo" alt="Discord Logo" align="left" viewBox="0 0 71 55" aria-hidden="true"><path d="M60.1045 4.8978C55.5792 2.8214 50.7265 1.2916 45.6527 0.41542C45.5603 0.39851 45.468 0.440769 45.4204 0.525289C44.7963 1.6353 44.105 3.0834 43.6209 4.2216C38.1637 3.4046 32.7345 3.4046 27.3892 4.2216C26.905 3.0581 26.1886 1.6353 25.5617 0.525289C25.5141 0.443589 25.4218 0.40133 25.3294 0.41542C20.2584 1.2888 15.4057 2.8186 10.8776 4.8978C10.8384 4.9147 10.8048 4.9429 10.7825 4.9795C1.57795 18.7309 -0.943561 32.1443 0.293408 45.3914C0.299005 45.4562 0.335386 45.5182 0.385761 45.5576C6.45866 50.0174 12.3413 52.7249 18.1147 54.5195C18.2071 54.5477 18.305 54.5139 18.3638 54.4378C19.7295 52.5728 20.9469 50.6063 21.9907 48.5383C22.0523 48.4172 21.9935 48.2735 21.8676 48.2256C19.9366 47.4931 18.0979 46.6 16.3292 45.5858C16.1893 45.5041 16.1781 45.304 16.3068 45.2082C16.679 44.9293 17.0513 44.6391 17.4067 44.3461C17.471 44.2926 17.5606 44.2813 17.6362 44.3151C29.2558 49.6202 41.8354 49.6202 53.3179 44.3151C53.3935 44.2785 53.4831 44.2898 53.5502 44.3433C53.9057 44.6363 54.2779 44.9293 54.6529 45.2082C54.7816 45.304 54.7732 45.5041 54.6333 45.5858C52.8646 46.6197 51.0259 47.4931 49.0921 48.2228C48.9662 48.2707 48.9102 48.4172 48.9718 48.5383C50.038 50.6034 51.2554 52.5699 52.5959 54.435C52.6519 54.5139 52.7526 54.5477 52.845 54.5195C58.6464 52.7249 64.529 50.0174 70.6019 45.5576C70.6551 45.5182 70.6887 45.459 70.6943 45.3942C72.1747 30.0791 68.2147 16.7757 60.1968 4.9823C60.1772 4.9429 60.1437 4.9147 60.1045 4.8978ZM23.7259 37.3253C20.2276 37.3253 17.3451 34.1136 17.3451 30.1693C17.3451 26.225 20.1717 23.0133 23.7259 23.0133C27.308 23.0133 30.1626 26.2532 30.1066 30.1693C30.1066 34.1136 27.28 37.3253 23.7259 37.3253ZM47.3178 37.3253C43.8196 37.3253 40.9371 34.1136 40.9371 30.1693C40.9371 26.225 43.7636 23.0133 47.3178 23.0133C50.9 23.0133 53.7545 26.2532 53.6986 30.1693C53.6986 34.1136 50.9 37.3253 47.3178 37.3253Z"/></svg>`,
  TWITCH_ID: `<svg class="logo" alt="Twitch Logo" align="left" viewBox="0 0 2400 2800" aria-hidden="true"><path d="M500,0L0,500v1800h600v500l500-500h400l900-900V0H500z M2200,1300l-400,400h-400l-350,350v-350H600V200h1600V1300z"/><rect x="1700" y="550" width="200" height="600"/><rect x="1150" y="550" width="200" height="600"/></svg>`,
  STEAM_ID: `<svg class="logo" alt="Steam Logo" align="left" viewBox="0 0 95.1 91.21" aria-hidden="true"><path d="M95.1,13.23a4.41,4.41,0,1,1-8.81,0,4.41,4.41,0,1,1,8.81,0Zm-8.15,0a3.74,3.74,0,1,0,7.48,0,3.74,3.74,0,1,0-7.48,0ZM90.75,11c1.16,0,1.51.61,1.51,1.24a1.31,1.31,0,0,1-.79,1.2l1,1.93h-.78l-.87-1.72H89.9v1.72h-.64V11Zm-.85,2h.81a.77.77,0,0,0,.85-.75c0-.42-.22-.69-.85-.69H89.9Z"/><path d="M45.45,0A45.6,45.6,0,0,0,0,42l24.44,10.1a12.89,12.89,0,0,1,7.27-2.24l.72,0L43.3,34.07v-.22a17.2,17.2,0,1,1,17.2,17.2h-.39L44.6,62.11c0,.2,0,.4,0,.61a12.91,12.91,0,0,1-25.57,2.54L1.57,58A45.6,45.6,0,1,0,45.45,0Z"/><path d="M28.58,69.2,23,66.88a9.68,9.68,0,1,0,5.3-13.24L34.07,56A7.13,7.13,0,1,1,28.58,69.2Z"/><path d="M72,33.85A11.47,11.47,0,1,0,60.5,45.31,11.48,11.48,0,0,0,72,33.85Zm-20,0a8.61,8.61,0,1,1,8.6,8.61A8.61,8.61,0,0,1,51.91,33.83Z"/></svg>`,
  TWITTER_ID: `<svg class="logo" alt="Twitter Logo" align="left" viewBox="0 0 248 204" aria-hidden="true"><g><path d="M221.95,51.29c0.15,2.17,0.15,4.34,0.15,6.53c0,66.73-50.8,143.69-143.69,143.69v-0.04   C50.97,201.51,24.1,193.65,1,178.83c3.99,0.48,8,0.72,12.02,0.73c22.74,0.02,44.83-7.61,62.72-21.66   c-21.61-0.41-40.56-14.5-47.18-35.07c7.57,1.46,15.37,1.16,22.8-0.87C27.8,117.2,10.85,96.5,10.85,72.46c0-0.22,0-0.43,0-0.64   c7.02,3.91,14.88,6.08,22.92,6.32C11.58,63.31,4.74,33.79,18.14,10.71c25.64,31.55,63.47,50.73,104.08,52.76   c-4.07-17.54,1.49-35.92,14.61-48.25c20.34-19.12,52.33-18.14,71.45,2.19c11.31-2.23,22.15-6.38,32.07-12.26   c-3.77,11.69-11.66,21.62-22.2,27.93c10.01-1.18,19.79-3.86,29-7.95C240.37,35.29,231.83,44.14,221.95,51.29z"/></g></svg>`,
  YOUTUBE_ID: `<svg class="logo" alt="YouTube Logo" align="left" viewBox="0 0 176 124" aria-hidden="true"><path fill="#282828" d="M172.32,19.36A22.12,22.12,0,0,0,156.76,3.7C143,0,88,0,88,0S33,0,19.24,3.7A22.12,22.12,0,0,0,3.68,19.36C0,33.18,0,62,0,62s0,28.82,3.68,42.64A22.12,22.12,0,0,0,19.24,120.3C33,124,88,124,88,124s55,0,68.76-3.7a22.12,22.12,0,0,0,15.56-15.66C176,90.82,176,62,176,62S176,33.18,172.32,19.36Z"></path><polygon fill="#fff" points="70 88.17 116 62 70 35.83 70 88.17"></polygon></svg>`,
};

function getUsername(accounttype, accountid) {
  return new Promise((resolve, reject) => {
    if (accountid == null)
      return resolve({
        name: "Add!",
        isaddbutton: true,
      });
    if (accounttype in predata) return resolve(predata[accounttype]);
    switch (accounttype) {
      case "GITHUB_ID":
        fetch("https://api.github.com/user/" + accountid)
          .then(a => a.json())
          .then(resolve)
          .catch(reject);
        break;
      case "DISCORD_ID":
        fetch("/api/discord/getname?id=" + accountid)
          .then(a => a.text())
          .then(username =>
            resolve({
              name: username,
            })
          )
          .catch(reject);
        break;
      case "TWITCH_ID":
        fetch("/api/twitch/getname?id=" + accountid)
          .then(a => a.text())
          .then(username =>
            resolve({
              name: username,
              html_url: "https://twitch.tv/" + username,
            })
          )
          .catch(reject);
        break;
      case "TWITTER_ID":
        fetch("/api/twitter/getname?id=" + accountid)
          .then(a => a.json())
          .then(data => {
            console.log(ids, ids[accounttype], accountid);
            data.html_url = "https://twitter.com/" + data.screen_name;
            resolve(data);
          })
          .catch(reject);
        break;
      case "STEAM_ID":
        fetch("/api/steam/getname?id=" + accountid)
          .then(a => a.json())
          .then(data => {
            data.name = data.personaname;
            data.html_url = data.profileurl;
            resolve(data);
          })
          .catch(reject);
        break;
      case "YOUTUBE_ID":
        fetch("/api/youtube/getname?id=" + accountid)
          .then(a => a.json())
          .then(data => {
            data.name = data.snippet.title;
            data.html_url = "https://youtube.com/channel/" + data.id;
            resolve(data);
          })
          .catch(reject);
        break;
    }
  });
}

window.addEventListener("load", () => {
  for (let account in ids) {
    // Check if we actually recognize this account type
    if (logos.hasOwnProperty(account))
      if ((ids[account] != null || userid === ids.ID) && account != "ID") {
        //   Is account linked            Are we authenticated (Add buttons)    Is it the MOVR field
        let div = document.createElement("div");
        let table = document.createElement("table");
        let tbody = document.createElement("tbody");
        table.appendChild(tbody);
        let tr1 = document.createElement("tr");
        let tr2 = document.createElement("tr");
        let tdlogo = document.createElement("td");
        let logo = document.createElement("svg");
        tdlogo.appendChild(logo);
        logo.outerHTML = logos[account];
        tdlogo.rowSpan = 2;
        tr1.appendChild(tdlogo);
        let acctype = document.createElement("td");
        acctype.classList = "smallcaps";
        acctype.innerText = account.slice(0, -3);
        tr1.appendChild(acctype);
        let accname = document.createElement("td");
        accname.innerText = "Loading...";
        getUsername(account, ids[account]).then(username => {
          console.log(username);
          animate(accname, username.name, 0);
          if (username.html_url) div.onclick = () => open(username.html_url);
          if (username.isaddbutton)
            div.onclick = event => {
              switch (account) {
                case "GITHUB_ID":
                  location = `https://github.com/login/oauth/authorize?scope=user:email&client_id=${movrdata.ghid}&redirect_uri=${location.origin}/auth/github/add`;
                  break;
                case "DISCORD_ID":
                  location = `https://discord.com/api/oauth2/authorize?client_id=${movrdata.discordid}&redirect_uri=${location.origin}/auth/discord/add&response_type=code&scope=identify&prompt=consent`;
                  break;
                case "TWITCH_ID":
                  location = `/redirect/twitch/add`;
                  break;
                case "TWITTER_ID":
                  location = `/redirect/twitter/add`;
                  break;
                case "STEAM_ID":
                  location = `/redirect/steam/add`;
                  break;
                case "YOUTUBE_ID":
                  location = `/redirect/youtube/add`;
                  break;
                default:
                  break;
              }
            };
        });
        tr2.appendChild(accname);
        tbody.appendChild(tr1);
        tbody.appendChild(tr2);
        div.appendChild(table);
        div.classList = "account";
        document.getElementById("accounts").appendChild(div);
      }
  }
});
