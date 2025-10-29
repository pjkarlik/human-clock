import "./styles.scss";
import { charSheet, ampmSheet } from "./theme-jack";
import { SpriteAnimator } from './sprite-animator';


const makeButton = (path, content) => {
  const liEl = document.createElement("li");
  const button = document.createElement("a");
  button.innerHTML = content;
  button.addEventListener(
    "click",
    () => {
      window.location = path;
    },
    false
  );
  liEl.appendChild(button);
  return liEl;
};
window.addEventListener("DOMContentLoaded", async () => {
  const clocks = document.createElement("ul");
  clocks.classList.add("selector");

  const ck1 = makeButton("./","a");
  const ck2 = makeButton("./plastic","b");
  const ck3 = makeButton("./jack","c");

  clocks.appendChild(ck1);
  clocks.appendChild(ck2);
  clocks.appendChild(ck3);

  document.body.appendChild(clocks);

  const clock = document.createElement("div");
  clock.classList.add('clock');
  document.body.appendChild(clock);

  const digitA = new SpriteAnimator(clock, charSheet, 160, 240, 5, 24, 40, 20);
  digitA.start(); 
  const digitB = new SpriteAnimator(clock, charSheet, 160, 240, 5, 24, 40, 20);
  digitB.start(); 

  const colon = document.createElement("div");
  colon.textContent = ":";
  colon.classList.add("colon");
  clock.appendChild(colon);

  const digitC = new SpriteAnimator(clock, charSheet, 160, 240, 5, 24, 40, 20);
  digitC.start(); 
  const digitD = new SpriteAnimator(clock, charSheet, 160, 240, 5, 24, 40, 20);
  digitD.start(); 

  const ampm = new SpriteAnimator(clock, ampmSheet, 80, 120, 5, 24, 8, 20, 121, 'ampm');
  ampm.start(); 

  let counter = 0;
  // Helper function to update all digits to the current time
  const updateTime = async () => {
    const now = new Date();
    let hours = now.getHours();
    const minutes = now.getMinutes();
    const isPM = hours >= 12;
    hours = hours % 12 || 12; // convert to 12-hour format
    const hStr = hours.toString().padStart(2, "0");
    const mStr = minutes.toString().padStart(2, "0");
    const timeStr = hStr + mStr;


    if(isPM && counter == 4){
        ampm.incrementDigit(1);
    }else if (counter == 4){
        ampm.incrementDigit(0);
    }

    timeStr.split("").forEach((num, i) => {
      const digit = Number(num);
      if (i === 0 && counter == 0) digitA.incrementDigit(digit);
      if (i === 1 && counter == 1) digitB.incrementDigit(digit);
      if (i === 2 && counter == 2) digitC.incrementDigit(digit);
      if (i === 3 && counter == 3) digitD.incrementDigit(digit);
    });
    counter++;
    if (counter > 4) counter = 0;
  };

  // Run once on load
  await updateTime();

  // Then update every x seconds
  setInterval(updateTime, 5000);
});
