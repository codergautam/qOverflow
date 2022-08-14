
              let darkMode = `<style id="darkMode">
              .bg-white {
                background-color: rgb(34, 34, 34);
              }
              .bg-gray-50 {
                background-color: rgb(51, 51, 51);
              }
              .bg-gray-200 {
                background-color: rgb(66, 66, 66);
              }
              .bg-green-200 {
                background-color: rgb(70, 167, 135);
              }
              .bg-blue-500 {
                background-color: rgb(16, 20, 34);
              }
              .text-black {
                color: rgb(255, 255, 255);
              }
              .text-gray-700 {
                color: rgb(224, 224, 224);
              }
              .text-gray-900 {
                color: rgb(225, 225, 225)
              }
              .shadow-indigo-600 {
                  --tw-shadow-color: rgb(12 12 12);
                  --tw-shadow: var(--tw-shadow-colored);
              }
              </style>`;
              darkMode = (!document.getElementById("darkMode")) ? darkMode : document.getElementById("darkMode");
                let darkElem = `
              <svg style="color: #FFFFFF" onclick="switchLight()" xmlns="http://www.w3.org/2000/svg" class="cursor-pointer h-6 mb-3 w-6 stroke-black" fill="none" viewBox="0 0 24 24" stroke="#FFFFFF" stroke-width="2">
                <path  stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" stroke="#FFFFFF" />
              </svg>`;
      
                let lightElem = `<svg onclick="switchLight()" xmlns="http://www.w3.org/2000/svg" class="cursor-pointer mb-3 h-6 w-6 stroke-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>`;
      
                checkLightMode();
                async function checkLightMode() {
                  let msg = await getLightMode();
                  console.log(msg);
                  if(msg == "light" || msg == "default") {
                    if(document.getElementById("darkMode")) {
                      document.getElementById("darkMode").remove();
                    }
                    if(document.getElementById("lightModeIcon")) {
                      document.getElementById("lightModeIcon").innerHTML = lightElem;
                    }
                  } else if(msg == "dark") {
                    if(document.getElementById("lightModeIcon")) {
                      document.getElementById("lightModeIcon").innerHTML = darkElem;
                    }
                    document.body.insertAdjacentHTML("beforebegin", darkMode);
                  }
                }
                async function switchLight() {
                  let mode = await getLightMode();
                  if(mode == "light" || mode == "default") {
                    let data = await fetch("/lightMode?lightMode=dark");
                    data = await data.json();
                    console.log(`Changed from light to ${data}`);
                  } else {
                    let data = await fetch("/lightMode?lightMode=light");
                    data = await data.json();
                    console.log(`Changed from dark to ${data}`);
                  }
                  location.reload();
                }
      
                async function getLightMode() {
                  let lightMode = await fetch('/lightMode');
                  lightMode = await lightMode.json();
                  return lightMode
                }