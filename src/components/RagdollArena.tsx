import { useEffect, useRef, useState, useCallback } from 'react';
import { CHARACTERS, getCharacter, type CharacterDef, BOSSES, getBoss, type BossDef } from './CharacterData';

// ═══════════════════════════════════════════════════════
// MATH
// ═══════════════════════════════════════════════════════
const W = 1280, H = 720, GY = 575, GRAV = 0.4;
const WORLD_W = 6000;
const WALL_L = 50, WALL_R = WORLD_W - 50;
const MAX_HP = 250;
interface V { x: number; y: number }
const v = (x = 0, y = 0): V => ({ x, y });
const vadd = (a: V, b: V): V => ({ x: a.x + b.x, y: a.y + b.y });
const vsub = (a: V, b: V): V => ({ x: a.x - b.x, y: a.y - b.y });
const vscl = (a: V, s: number): V => ({ x: a.x * s, y: a.y * s });
const vlen = (a: V) => Math.sqrt(a.x * a.x + a.y * a.y);
const vnorm = (a: V): V => { const l = vlen(a) || 1; return { x: a.x / l, y: a.y / l }; };
const vlerp = (a: V, b: V, t: number): V => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const clamp = (v2: number, mn: number, mx: number) => Math.max(mn, Math.min(mx, v2));
const rng = (mn: number, mx: number) => mn + Math.random() * (mx - mn);
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// ═══════════════════════════════════════════════════════
// SOUND FX SYSTEM (Web Audio)
// ═══════════════════════════════════════════════════════
let audioCtx: AudioContext | null = null;
const getAudioCtx = () => {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
};

const playSFX = (type: 'hit' | 'slash' | 'heavyHit' | 'block' | 'kick' | 'headbutt' | 'gunshot' | 'sever' | 'ko' | 'roundStart' | 'footstep' | 'whoosh', vol = 0.15) => {
  try {
    const ctx = getAudioCtx();
    const g = ctx.createGain();
    g.gain.value = vol;
    g.connect(ctx.destination);

    if (type === 'hit' || type === 'kick') {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(type === 'kick' ? 80 : 120, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.08);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.connect(g); osc.start(); osc.stop(ctx.currentTime + 0.1);
      // Noise burst for impact
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const noise = ctx.createBufferSource();
      noise.buffer = buf;
      const ng = ctx.createGain(); ng.gain.value = vol * 0.6;
      ng.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
      noise.connect(ng); ng.connect(ctx.destination); noise.start(); noise.stop(ctx.currentTime + 0.06);
    } else if (type === 'slash') {
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.12, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.sin(i / data.length * Math.PI) * 0.5;
      const noise = ctx.createBufferSource(); noise.buffer = buf;
      const filter = ctx.createBiquadFilter(); filter.type = 'highpass'; filter.frequency.value = 2000;
      noise.connect(filter); filter.connect(g); noise.start(); noise.stop(ctx.currentTime + 0.12);
    } else if (type === 'heavyHit') {
      const osc = ctx.createOscillator(); osc.type = 'square';
      osc.frequency.setValueAtTime(60, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(20, ctx.currentTime + 0.2);
      g.gain.value = vol * 1.5;
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(g); osc.start(); osc.stop(ctx.currentTime + 0.25);
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const noise = ctx.createBufferSource(); noise.buffer = buf;
      const ng = ctx.createGain(); ng.gain.value = vol;
      noise.connect(ng); ng.connect(ctx.destination); noise.start(); noise.stop(ctx.currentTime + 0.1);
    } else if (type === 'block') {
      const osc = ctx.createOscillator(); osc.type = 'triangle';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.08);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.connect(g); osc.start(); osc.stop(ctx.currentTime + 0.1);
    } else if (type === 'headbutt') {
      const osc = ctx.createOscillator(); osc.type = 'sine';
      osc.frequency.setValueAtTime(200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.15);
      g.gain.value = vol * 1.2;
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      osc.connect(g); osc.start(); osc.stop(ctx.currentTime + 0.18);
    } else if (type === 'gunshot') {
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (data.length * 0.15));
      const noise = ctx.createBufferSource(); noise.buffer = buf;
      g.gain.value = vol * 2;
      noise.connect(g); noise.start(); noise.stop(ctx.currentTime + 0.08);
    } else if (type === 'sever') {
      const osc = ctx.createOscillator(); osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.3);
      g.gain.value = vol * 1.8;
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(g); osc.start(); osc.stop(ctx.currentTime + 0.35);
    } else if (type === 'ko') {
      for (let i = 0; i < 3; i++) {
        const osc = ctx.createOscillator(); osc.type = 'square';
        osc.frequency.setValueAtTime(100 - i * 20, ctx.currentTime + i * 0.1);
        osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + i * 0.1 + 0.3);
        const og = ctx.createGain(); og.gain.value = vol * 2;
        og.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 0.35);
        osc.connect(og); og.connect(ctx.destination); osc.start(ctx.currentTime + i * 0.1); osc.stop(ctx.currentTime + i * 0.1 + 0.35);
      }
    } else if (type === 'roundStart') {
      [400, 500, 700].forEach((f, i) => {
        const osc = ctx.createOscillator(); osc.type = 'square';
        osc.frequency.value = f;
        const og = ctx.createGain(); og.gain.value = vol * 0.5;
        og.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.2);
        osc.connect(og); og.connect(ctx.destination); osc.start(ctx.currentTime + i * 0.15); osc.stop(ctx.currentTime + i * 0.15 + 0.2);
      });
    } else if (type === 'whoosh') {
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.sin(i / data.length * Math.PI) * 0.3;
      const noise = ctx.createBufferSource(); noise.buffer = buf;
      const filter = ctx.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = 3000; filter.Q.value = 2;
      noise.connect(filter); filter.connect(g); noise.start(); noise.stop(ctx.currentTime + 0.1);
    }
  } catch (e) { /* audio not available */ }
};

// ═══════════════════════════════════════════════════════
// TTS SYSTEM - Context-specific R-rated lines with unique voices
// ═══════════════════════════════════════════════════════

// Lines when YOUR limb gets severed (spoken by the victim)
const LIMB_LOST_LINES = [
  "Holy fuck my fucking leg is gone!",
  "Ahh stop you bitch!",
  "That was my good arm you piece of shit!",
  "I NEED that you psychopath!",
  "What the fuck?! My arm!",
  "Oh god oh fuck that's a lot of blood!",
  "You ripped my goddamn leg off!",
  "That's it I'm suing your ass!",
  "MY LEG! MY BEAUTIFUL LEG!",
  "Dude that was attached to me!",
  "How am I supposed to fight with no arm?!",
  "You absolute shithead that was my favorite limb!",
  "AAAHHH MOTHER OF GOD!",
  "That's not how joints work you maniac!",
  "I can see the bone! I CAN SEE THE BONE!",
  "You just ripped off my... oh I'm gonna be sick",
  "Put that back! PUT THAT BACK!",
  "Cool cool cool my leg is over there now",
  "That was still under warranty!",
  "Holy shit I'm literally falling apart!",
  "BRO that's my wiping hand!",
  "My arm! I had plans for that arm!",
  "Oh nice now I'm asymmetrical!",
  "Was the dismemberment really necessary Karen?!",
  "Mommy I want to go home!",
  "I didn't consent to amputation!",
  "Well there goes my basketball career!",
  "You owe me a prosthetic you dick!",
  "MY KNEE! MY BEAUTIFUL KNEE!",
  "I can't even flip you off anymore!",
  "Okay NOW I'm pissed!",
  "You know what, I didn't need that anyway",
  "I JUST got that limb waxed!",
  "That was my texting hand you monster!",
  "Congratulations you just ruined my yoga practice!",
  "This is a workplace safety violation!",
  "File that under things I didn't want today!",
  "You tore off my arm like a chicken wing!",
  "I literally just healed from last round!",
  "My physical therapist is gonna be SO mad!",
  "Well at least it wasn't my head... yet",
  "I hope you stub your toe every morning!",
  "Are you EATING my leg?! What the fu-",
  "MEDIC! MEDIIIIIC!",
  "That was my dominant arm you ass!",
  "Oh look I'm a human starfish now",
  "I paid good money for that limb!",
  "You fight like a goddamn blender!",
  "Alright who ordered the amputation?!",
  "FUCK FUCK FUCK FUCK FUCKKKK!",
  "Oh great now my blood's everywhere! Who's cleaning this?!",
  "You pulled that off like a drumstick at Thanksgiving!",
  "My arm is waving at me from over there and that's fucked up!",
  "This isn't Build-A-Bear you can't just rip parts off!",
  "I was gonna use that to hold my beer later!",
  "You popped my arm off like a Lego piece what the FUCK!",
  "Is there a lost and found for body parts?!",
  "Oh cool so we're doing war crimes today!",
  "My leg just yeeted itself across the arena!",
  "I need an adult! A MEDICAL adult!",
  "That wasn't a joint it was a BONE you dipshit!",
  "I bet you pull wings off flies too you sick freak!",
  "My stump is making noises I don't like!",
  "This is NOT what my horoscope predicted today!",
  "Well that arm had a good run. RIP lefty.",
  "How dare you! That arm was an INNOCENT BYSTANDER!",
  "I'm gonna need so much therapy after this!",
  "Oh wonderful now I'm a pirate! Where's my parrot?!",
  "I can feel it! I can still feel it twitching over there!",
  "That was my drinking arm you ANIMAL!",
  "Oh so THIS is what a phantom limb feels like!",
  "My Tinder photos are RUINED!",
  "You tore that off like a receipt from CVS!",
  "I literally just did push ups with that arm!",
  "Great now I look like a broken action figure!",
  "You know arms don't grow back right you IDIOT?!",
  "I was saving that leg for running away!",
  "My limb just flew further than I ever could!",
  "That was load bearing! I needed that to STAND!",
  "Oh fantastic now I match the Venus de Milo!",
  "Do you KNOW how long it took to grow that?!",
  "My ex said I'd fall apart and HERE WE ARE!",
  "I can see my own shoulder socket and I hate it!",
  "That used to be connected! It was IMPORTANT!",
  "You just made me a clearance rack human!",
  "I'm like a Mr Potato Head but REAL and in PAIN!",
  "Well there goes my OnlyFans career!",
  "Five second rule! Someone grab my arm!",
  "This is the WORST game of Operation ever!",
  "My limb just ragdolled harder than I did!",
];

// Lines when YOUR head gets severed
const HEAD_LOST_LINES = [
  "Well shit that was my thinking part!",
  "I can still see! Oh wait no I can't...",
  "Tell my mom I love heeerrr...",
  "My head! Has anyone seen my head?!",
  "This is the worst haircut I've ever had!",
  "Decapitated? In THIS economy?!",
  "I specifically said no beheading!",
  "That's... that's not supposed to come off...",
  "Oh so we're doing decapitations today cool cool",
  "I was using that!",
  "My brain was in there you know!",
  "Great now I'm a headless horseman without the horse!",
  "Huh. So that's what my neck looks like inside.",
  "Three stars, would not recommend getting decapitated!",
  "Tell my barber he doesn't need to hold the appointment!",
  "My head is bouncing! That's so disrespectful!",
  "I just watched my body from a weird angle!",
  "Return to sender! RETURN TO SENDER!",
  "Was that a clean cut at least? For the open casket?",
  "My head just rolled into the cheap seats!",
];

// Lines spoken by the WINNER after KO
const KO_WINNER_LINES = [
  "Get absolutely wrecked mate!",
  "Was that your head or a watermelon?",
  "You fight like my dead grandma!",
  "I'll use your spine as a back scratcher!",
  "Your mother fights better than you!",
  "I've seen potatoes with more fight!",
  "Say hello to the dirt for me!",
  "You just got absolutely demolished!",
  "Boom! Headshot! Wait wrong game.",
  "Is that all you've got? Pathetic!",
  "I didn't even break a sweat!",
  "You're going home in a body bag!",
  "Rest in pieces you absolute walnut!",
  "That's what you get for showing up!",
  "I could beat you with one arm! Oh wait I just did!",
  "Someone call a hearse and a therapist!",
  "Sit DOWN clown!",
  "You fought like a drunk toddler!",
  "Tell the devil I said wassup!",
  "That's for looking at me funny!",
  "You just got ratio'd in real life!",
  "Delete your fighter account bro!",
  "I've slapped harder in my sleep!",
  "GG EZ no re!",
  "You got bodied son! BODIED!",
  "Another day another corpse!",
  "You should try a different hobby like breathing!",
  "I just made modern art outta your face!",
  "Don't worry your skull will buffer out!",
  "Get rekt scrub!",
  "Your ancestors felt that one!",
  "This isn't even my final form!",
  "Somebody get a mop for this mess!",
  "You just brought a face to a sword fight!",
  "I've seen scarecrows put up more of a fight!",
  "And THAT is why you don't skip training!",
  "You need milk!",
  "That was embarrassing for both of us honestly!",
  "I'm adding this to my highlight reel!",
  "First round knockout! Thanks for coming!",
  "Your fighting style is called Losing!",
  "I've beaten tougher sandwiches!",
  "You were supposed to block that genius!",
  "Your health bar said nah I'm out!",
  "Someone order an ambulance and a priest!",
  "I just committed several war crimes!",
  "You went from warrior to floor decoration!",
  "I didn't know they let punching bags in the arena!",
  "Flawless victory! Just kidding I got a scratch!",
  "Sorry not sorry!",
  "I just turned you into a before picture!",
  "Your remains are gonna need remains!",
  "I'd say good fight but... it really wasn't!",
  "You just got folded like a lawn chair!",
  "That was me at like fifteen percent effort!",
  "Your corpse is lowering property values!",
  "I'm gonna teabag you but respectfully!",
  "You got clapped so hard your ancestors winced!",
  "That was less of a fight and more of a charity event!",
  "Pro tip: try not dying next time!",
  "I just turned you into a cautionary tale!",
  "You fought like a screen door in a hurricane!",
  "I'd give you a participation trophy but you lost that too!",
  "Your blood is all over my good shoes you dick!",
  "That kill was so clean I should frame it!",
  "I'm gonna put your skull on my mantle!",
  "I hit you so hard your grandkids will feel it!",
  "Consider yourself unalived with extreme prejudice!",
  "You just speedran losing!",
  "That wasn't a fight, that was assisted suicide!",
  "Your fighting skills are a hate crime against combat!",
  "I turned your skeleton into abstract art!",
  "You should've stayed in bed today champ!",
  "I fight better with my eyes closed! Which I tried!",
  "Thanks for the workout! Barely broke a sweat!",
  "I just beat you so bad your respawn button is crying!",
  "Your funeral is gonna be a celebration for ME!",
  "I'm framing your skull as a conversation piece!",
  "You got deleted from existence! Ctrl Z won't save you!",
  "I just made you the BEFORE in a before and after ad!",
  "Even your shadow is embarrassed right now!",
  "You got annihilated so hard the replay skipped!",
  "I broke you like a Kit Kat and I'm not sharing!",
  "You're not even a worthy sacrifice to my ego!",
  "I've seen better fights at a kindergarten!",
  "Your fighting license should be revoked!",
  "I just turned you into a PSA about fighting me!",
  "That was surgical! I should bill your insurance!",
  "You brought dishonor to your entire bloodline!",
  "I'd feel bad but I physically can't!",
  "Consider that a free anatomy lesson!",
  "You expired faster than gas station sushi!",
  "I'm not even your biggest problem now. Gravity is.",
];

// Lines spoken by the LOSER during/after KO
const KO_LOSER_LINES = [
  "Holy shit I'm fucked!",
  "You just beat me with my own arm you knob goblin!",
  "Well that's my spine... great.",
  "I think I left my dignity back there...",
  "Was that my head? I need that!",
  "Tell my wife... she was right about everything.",
  "I can't feel my legs... oh wait they're over there.",
  "This is fine. Everything is fine.",
  "At least buy me dinner first!",
  "My insurance doesn't cover this!",
  "You absolute psychopath!",
  "I specifically asked you not to do that!",
  "That's coming out of your paycheck!",
  "Ow ow ow ow OW!",
  "I quit! I freaking quit!",
  "Next time I'm bringing a gun... oh wait.",
  "My ancestors are very disappointed right now.",
  "I didn't sign up for this!",
  "Was the decapitation really necessary?!",
  "You fight dirty and I respect that... from the grave.",
  "I think I swallowed a tooth... or six",
  "Why does everything taste like copper?!",
  "That's it I'm calling my lawyer!",
  "This is NOT what the brochure promised!",
  "I want a refund on this life!",
  "My chiropractor is gonna flip out!",
  "Is it too late to surrender?!",
  "I could feel that in my SOUL!",
  "You're going on my blocked list!",
  "I hope they remember me as handsome!",
  "I had a family you know!",
  "Respawn? RESPAWN?! Hello?!",
  "Five stars would NOT recommend fighting this guy!",
  "I think you broke my everything!",
  "Well I just got speed-ran!",
  "This is definitely going on my tombstone!",
  "Do you validate parking at least?!",
  "I can see a white light... never mind that's a sword!",
  "My face! My beautiful face!",
  "I should have been a librarian!",
  "Okay I deserved maybe ONE hit not FORTY!",
  "Someone tell my dog I love him!",
  "I'm too pretty to die like this!",
  "That escalated quickly!",
  "Warning label said may cause death and it wasn't lying!",
  "I'd like to speak to the manager of this arena!",
  "My spine just filed for divorce!",
  "Note to self never do this again!",
  "This is the worst Tuesday ever!",
  "I think that last hit dislocated my SOUL!",
  "I just shit myself and I'm not even embarrassed anymore!",
  "My blood type is now sidewalk!",
  "I've been turned into a human pretzel!",
  "Quick question can you die twice?!",
  "I think my organs just became outgans!",
  "My last words are... this guy's a dick!",
  "Can I get a do-over?! Please?! PLEASE?!",
  "I just got murdered in front of God and everybody!",
  "Alexa call an ambulance! ALEXA!",
  "I didn't know my body could bend that direction!",
  "My ribs are in places ribs shouldn't be!",
  "That was my last good kidney you jerk!",
  "I've been killed but I want it on record I think it's unfair!",
  "Delete the footage! DELETE THE FOOTAGE!",
  "I'm gonna haunt your ass so hard!",
  "My whole life flashed before my eyes and it was BORING!",
  "You just turned me into a crime scene!",
  "Is there a complaint department in the afterlife?!",
  "That was so overkill it was underkill and then overkill again!",
  "My tombstone is gonna say killed by a tryhard!",
  "Well that was the worst three seconds of my existence!",
  "I hope you know I'm sending you the medical bill!",
  "You murdered me and you didn't even look cool doing it!",
  "This is bullshit! I call hacks!",
  "I've been absolutely violated in every conceivable way!",
  "My ghost is already filing a police report!",
  "I just saw my own skeleton and it looked disappointed!",
  "My soul just left my body and flipped me off!",
  "I got hit so hard I time traveled to my own funeral!",
  "My ancestors just unfollowed me!",
  "I just experienced death and the reviews are terrible!",
  "I can see the loading screen for the afterlife!",
  "That last punch sent me to a different zip code!",
  "I just got turned into a motivational poster about failure!",
  "My death certificate is writing itself right now!",
  "I got destroyed so thoroughly my obituary just auto-generated!",
  "Even the grim reaper said that was excessive!",
  "My ghost already applied for witness protection!",
  "I died so hard my health bar filed a restraining order!",
  "I just became the Wikipedia entry for getting wrecked!",
  "My corpse is trending on social media for all the wrong reasons!",
];

// Lines during the ground beatdown
const BEATDOWN_LINES_WINNER = [
  "Stay down! STAY DOWN!",
  "Had enough yet?! NO?! Good!",
  "This is for fun now!",
  "I can do this all day!",
  "Stop hitting yourself! Oh wait that's me!",
  "Tenderizing the meat!",
  "How's that taste?!",
  "Take that! And that! AND THAT!",
  "Oh you want more?! HERE!",
  "I'm not done with you yet!",
  "You're a piñata and I want candy!",
  "This is what peak performance looks like!",
  "I'm doing this for the audience!",
  "You're already dead, this is just dessert!",
  "Hold still I'm trying to rearrange your face!",
  "I could stop but I don't WANT to!",
  "Somebody stop me! Actually don't!",
  "This is therapeutic! For ME not for you!",
  "Your face was ugly anyway I'm doing you a favor!",
  "I'm redecorating the floor with your skull!",
  "I'm turning you into MODERN ART!",
  "Every punch is a love letter from my fist!",
  "I'm not hitting you, I'm sculpting your face!",
  "This is what happens when you show up to MY arena!",
  "I bet you wish you called in sick today!",
  "You're my stress ball now!",
  "I'm writing my name on your face with my fists!",
  "Oh does that hurt? GOOD! Here's MORE!",
  "I'm giving you a free dental rearrangement!",
  "You picked the wrong day to have a face!",
];

const BEATDOWN_LINES_LOSER = [
  "Please stop oh god PLEASE STOP!",
  "I'M ALREADY DEAD!",
  "HE'S ALREADY DEAD DUDE!",
  "Okay I get it you won STOP HITTING ME!",
  "UNCLE! UNCLE! I SAID UNCLE!",
  "Can I at LEAST die with dignity?!",
  "You're kicking a dead horse! Literally!",
  "This is excessive force!",
  "Someone call the ref! THE REF!",
  "I'LL GIVE YOU MY WALLET JUST STOP!",
  "I YIELD! I YIELD! WHAT DOES YIELD MEAN?!",
  "My corpse is filing a complaint!",
  "Even my ghost is getting punched right now!",
  "This is just rude at this point!",
  "I forgive you just please STOP!",
  "My mother would be horrified!",
  "I can't even feel it anymore which is WORSE!",
  "You know I'm dead right?! RIGHT?!",
  "This is gonna be a closed casket for sure!",
  "I'm starting to think you have anger issues!",
  "I'm literally a corpse! What are you PROVING?!",
  "My insurance lapsed three punches ago!",
  "This is the most personal death I've ever had!",
  "I'm already dead just let me decompose in peace!",
  "You're punching a GHOST at this point!",
  "I'd cry but my tear ducts are in a different area code!",
  "This is NOT in the Geneva Convention!",
  "My soul is watching this from above and cringing!",
  "Stop! I'll tell you where the treasure is! There IS no treasure!",
  "My afterlife just sent a noise complaint!",
];

// Announcer lines
const KO_ANNOUNCER_LINES = [
  "FINISH HIM!", "DESTROYED!", "OBLITERATED!", "ANNIHILATED!",
  "WASTED!", "GAME OVER MAN!", "ABSOLUTELY BODIED!", "SENT TO THE SHADOW REALM!",
  "BRUTAL!", "SAVAGE!", "FATALITY!", "TOASTY!",
  "DEVASTATION!", "TOTAL ANNIHILATION!", "SLAUGHTERED!",
  "BUTCHERED!", "MASSACRED!", "EVISCERATED!",
  "WHAT A BLOODBATH!", "UNBELIEVABLE CARNAGE!", "ABSOLUTE DESTRUCTION!",
  "HE'S DONE! HE'S ABSOLUTELY DONE!", "THAT MAN HAD A FAMILY!",
  "SOMEBODY STOP THE FIGHT!", "LIGHTS OUT!", "DOWN GOES THE CHALLENGER!",
];

// ═══════════════════════════════════════════════════════
// TTS VOICE SYSTEM - 3 distinct male English voices
// ═══════════════════════════════════════════════════════

// Strict male English voice selection
// We want 3 DIFFERENT male voices - prioritize known male voice names
const VOICE_ROLE_PREFS: string[][] = [
  // Fighter 1 - deep, gruff male
  ['Daniel', 'Google UK English Male', 'Microsoft George', 'Microsoft David Desktop', 'James', 'Arthur', 'Fred'],
  // Fighter 2 - lighter, different male  
  ['Microsoft David', 'Google US English', 'Aaron', 'Tom', 'Alex', 'Rishi', 'Albert'],
  // Commentator - clear, distinct male
  ['Microsoft Mark', 'Microsoft Zira Desktop', 'Google UK English Male', 'Ralph', 'Bruce', 'Junior'],
];

// Each role gets distinct pitch/rate for guaranteed timbre difference
const VOICE_CONFIGS = [
  { pitch: 0.75, rate: 0.88 },   // Fighter 1: deep and slow - clearly distinct
  { pitch: 1.15, rate: 1.02 },   // Fighter 2: higher and slightly faster  
  { pitch: 0.95, rate: 1.1 },    // Commentator: mid-range, energetic pace
];

let lastTTSTime = 0;
let lastTTSByFighter = [0, 0, 0];
let cachedVoices: SpeechSynthesisVoice[] = [];
let voicesLoaded = false;
let assignedVoices: (SpeechSynthesisVoice | null)[] = [null, null, null];

// Known female voice names to exclude
const FEMALE_NAMES = ['samantha', 'karen', 'victoria', 'zira', 'susan', 'hazel', 'fiona', 'moira', 'tessa', 'allison', 'ava', 'joana', 'nicky', 'sandy', 'shelley', 'kate', 'serena', 'veena', 'catherine', 'princess', 'alice', 'emma', 'olivia', 'sophia', 'linda', 'rachel', 'jenny', 'emily', 'aria', 'lisa', 'helen', 'anna', 'sara'];

// Only allow explicitly male-indicating English voices (strict mode)
const MALE_NAMES = ['daniel', 'george', 'david', 'james', 'arthur', 'fred', 'aaron', 'tom', 'alex', 'rishi', 'albert', 'mark', 'ralph', 'bruce', 'junior', 'male'];

const isMaleEnglish = (v: SpeechSynthesisVoice): boolean => {
  if (!v.lang.toLowerCase().startsWith('en')) return false;
  const name = v.name.toLowerCase();
  if (FEMALE_NAMES.some((f) => name.includes(f))) return false;
  return MALE_NAMES.some((m) => name.includes(m));
};

const resolveRoleVoice = (roleIdx: number): SpeechSynthesisVoice | null => {
  const maleEn = cachedVoices.filter(isMaleEnglish);
  if (maleEn.length === 0) return null;

  const preferred = VOICE_ROLE_PREFS[roleIdx]
    ?.map((pref) => pref.toLowerCase())
    .find((pref) => maleEn.some((v) => v.name.toLowerCase().includes(pref)));

  if (preferred) {
    return maleEn.find((v) => v.name.toLowerCase().includes(preferred)) ?? null;
  }

  return maleEn[roleIdx % maleEn.length] ?? null;
};

// Preload voices
if (typeof window !== 'undefined' && window.speechSynthesis) {
  const loadVoices = () => {
    cachedVoices = speechSynthesis.getVoices();
    if (cachedVoices.length > 0) {
      voicesLoaded = true;
      for (let role = 0; role < 3; role++) {
        assignedVoices[role] = resolveRoleVoice(role);
      }
    }
  };
  loadVoices();
  speechSynthesis.onvoiceschanged = loadVoices;
}

const speakLine = (text: string, roleIdx = 2) => {
  try {
    const now = Date.now();
    if (now - lastTTSTime < 1500) return;
    if (now - lastTTSByFighter[roleIdx] < 2200) return;

    // HARD RULE: no verified male voice -> no TTS (never fallback to browser default)
    const voice = resolveRoleVoice(roleIdx) ?? assignedVoices[roleIdx];
    if (!voice || !isMaleEnglish(voice)) return;

    lastTTSTime = now;
    lastTTSByFighter[roleIdx] = now;

    speechSynthesis.cancel();

    const u = new SpeechSynthesisUtterance(text);
    const cfg = VOICE_CONFIGS[roleIdx] || VOICE_CONFIGS[2];
    u.pitch = cfg.pitch;
    u.rate = cfg.rate;
    u.volume = 0.85;
    u.voice = voice;

    speechSynthesis.speak(u);
  } catch (e) { /* TTS not available */ }
};

const speakFighterLine = (lines: string[], fighterIdx: number) => {
  speakLine(pick(lines), Math.min(fighterIdx, 1));
};

const speakAnnouncer = (text: string) => {
  speakLine(text, 2);
};

// ═══════════════════════════════════════════════════════
// RAGDOLL SYSTEM
// ═══════════════════════════════════════════════════════
interface RPoint { pos: V; old: V; acc: V; mass: number; pinned: boolean }
interface RStick { a: number; b: number; len: number; stiff: number }

function createRagdoll(x: number, y: number) {
  const S = 1.35;
  // FIXED: Longer legs to match torso proportions, added mid-spine flexibility
  const offsets: V[] = [
    v(0, -108*S), v(0, -93*S), v(0, -72*S), v(0, -52*S), v(0, -36*S),  // head, neck, upper chest, lower chest/mid-spine, hip
    v(-15*S, -86*S), v(-28*S, -64*S), v(-35*S, -46*S),  // left arm
    v(15*S, -86*S), v(28*S, -64*S), v(35*S, -46*S),  // right arm
    v(-10*S, -33*S), v(-13*S, -14*S), v(-11*S, 4),  // left leg (longer: hip->knee->foot)
    v(10*S, -33*S), v(13*S, -14*S), v(11*S, 4),  // right leg (longer)
  ];
  const pts: RPoint[] = offsets.map(o => ({
    pos: v(x + o.x, y + o.y), old: v(x + o.x, y + o.y),
    acc: v(0, 0), mass: 1, pinned: false,
  }));
  pts[0].mass = 0.8; pts[13].mass = 1.5; pts[16].mass = 1.5;
  const sticks: RStick[] = [
    { a: 0, b: 1, len: 15, stiff: 1 }, { a: 1, b: 2, len: 21, stiff: 1 },
    { a: 2, b: 3, len: 20, stiff: 0.7 }, // Mid-spine - LOWER stiffness for bending!
    { a: 3, b: 4, len: 16, stiff: 0.75 }, // Lower spine - also flexible
    { a: 1, b: 5, len: 16, stiff: 0.8 }, { a: 5, b: 6, len: 26, stiff: 0.7 }, { a: 6, b: 7, len: 20, stiff: 0.6 },
    { a: 1, b: 8, len: 16, stiff: 0.8 }, { a: 8, b: 9, len: 26, stiff: 0.7 }, { a: 9, b: 10, len: 20, stiff: 0.6 },
    { a: 4, b: 11, len: 12, stiff: 0.9 },  // hip to thigh (slightly longer)
    { a: 11, b: 12, len: 26, stiff: 0.85 }, // upper leg (was 18, now 26!)
    { a: 12, b: 13, len: 22, stiff: 0.85 }, // lower leg (was 16, now 22!)
    { a: 4, b: 14, len: 12, stiff: 0.9 },
    { a: 14, b: 15, len: 26, stiff: 0.85 }, // upper leg
    { a: 15, b: 16, len: 22, stiff: 0.85 }, // lower leg
    { a: 2, b: 5, len: 20, stiff: 0.5 }, { a: 2, b: 8, len: 20, stiff: 0.5 },
    { a: 4, b: 11, len: 12, stiff: 0.5 }, { a: 4, b: 14, len: 12, stiff: 0.5 },
    { a: 0, b: 2, len: 36, stiff: 0.4 }, { a: 11, b: 14, len: 20, stiff: 0.4 }, { a: 5, b: 8, len: 30, stiff: 0.4 },
    // Cross-braces for spine stability (but allow bending)
    { a: 1, b: 4, len: 76, stiff: 0.25 }, // spine cross-brace (loose for flex)
    { a: 2, b: 4, len: 36, stiff: 0.3 }, // lower spine brace
  ];
  return { pts, sticks };
}

function stepRagdoll(pts: RPoint[], sticks: RStick[], dt: number, bounce: number) {
  const MIN_Y = -400; // hard ceiling - nothing flies above this
  const MIN_X = -50;
  const MAX_X = WORLD_W + 50;
  for (const p of pts) {
    if (p.pinned) continue;
    const vel = vsub(p.pos, p.old);
    // Clamp velocity to prevent explosion
    const spd = vlen(vel);
    const clampedVel = spd > 40 ? vscl(vnorm(vel), 40) : vel;
    p.old = { ...p.pos };
    p.pos = vadd(p.pos, vadd(vscl(clampedVel, 0.97), vscl(p.acc, dt * dt)));
    p.acc = v(0, GRAV * p.mass);
    if (p.pos.y > GY) { p.pos.y = GY; if (vel.y > 0) p.old.y = p.pos.y + vel.y * bounce; p.old.x = p.pos.x - vel.x * 0.7; }
    if (p.pos.y < MIN_Y) { p.pos.y = MIN_Y; p.old.y = MIN_Y; }
    p.pos.x = clamp(p.pos.x, MIN_X, MAX_X);
    p.old.x = clamp(p.old.x, MIN_X, MAX_X);
    p.old.y = clamp(p.old.y, MIN_Y, GY + 20);
  }
  for (let iter = 0; iter < 6; iter++) {
    for (const s of sticks) {
      const a = pts[s.a], b = pts[s.b];
      const delta = vsub(b.pos, a.pos);
      const dist = vlen(delta) || 0.01;
      const diff = (s.len - dist) / dist * s.stiff;
      const offset = vscl(delta, diff * 0.5);
      if (!a.pinned) a.pos = vsub(a.pos, offset);
      if (!b.pinned) b.pos = vadd(b.pos, offset);
    }
    for (const p of pts) {
      if (p.pos.y > GY) p.pos.y = GY;
      if (p.pos.y < MIN_Y) p.pos.y = MIN_Y;
      p.pos.x = clamp(p.pos.x, MIN_X, MAX_X);
    }
  }
}

// Sanity check: snap ragdoll back if center of mass drifts too far
function clampRagdollToArena(f: { rag: { pts: RPoint[] }, x: number, y: number, severed: Set<string> }) {
  const pts = f.rag.pts;
  // Calculate center of mass of torso (pts 0-4)
  let cx = 0, cy = 0, count = 0;
  for (let i = 0; i < Math.min(5, pts.length); i++) {
    cx += pts[i].pos.x; cy += pts[i].pos.y; count++;
  }
  if (count === 0) return;
  cx /= count; cy /= count;
  
  // If center is way off, snap everything back
  const targetX = clamp(cx, WALL_L - 20, WALL_R + 20);
  const targetY = clamp(cy, -300, GY);
  const dx = targetX - cx;
  const dy = targetY - cy;
  if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
    for (const p of pts) {
      p.pos.x += dx; p.pos.y += dy;
      p.old.x += dx; p.old.y += dy;
    }
  }
  
  // If heavily severed (3+ limbs), add strong gravity pull to keep grounded
  if (f.severed.size >= 3) {
    for (const p of pts) {
      if (p.pos.y < GY - 30) {
        p.pos.y += 2; // extra gravity pull
      }
      // Heavy damping to prevent floating
      const vel = vsub(p.pos, p.old);
      p.old = vlerp(p.old, p.pos, 0.1);
    }
  }
}

// ═══════════════════════════════════════════════════════
// FATALITIES
// ═══════════════════════════════════════════════════════
interface FatalityDef {
  name: string;
  frames: number;
  description: string;
}

const FATALITIES: FatalityDef[] = [
  { name: 'DECAPITATION', frames: 60, description: 'Slices head clean off' },
  { name: 'SPINE RIP', frames: 80, description: 'Rips spine out through chest' },
  { name: 'SKULL CRUSH', frames: 70, description: 'Crushes skull with bare hands' },
  { name: 'IMPALEMENT', frames: 65, description: 'Impales through the chest and lifts' },
  { name: 'BISECTION', frames: 75, description: 'Cuts opponent in half vertically' },
  { name: 'LIMB TORNADO', frames: 90, description: 'Spins and tears all limbs off' },
  { name: 'HEAD PUNT', frames: 55, description: 'Kicks head off like a football' },
  { name: 'HEART RIP', frames: 70, description: 'Reaches in and pulls out heart' },
  { name: 'BONE BREAKER', frames: 80, description: 'Snaps every bone in sequence' },
  { name: 'GROUND POUND', frames: 85, description: 'Slams into ground repeatedly' },
  { name: 'WALL SPLAT', frames: 70, description: 'Throws into wall so hard they splatter' },
  { name: 'BLADE BLENDER', frames: 90, description: 'Spins weapon in a blender motion' },
  { name: 'CURB STOMP', frames: 60, description: 'Stomps head into the ground' },
  { name: 'UPPERCUT LAUNCH', frames: 75, description: 'Uppercuts so hard head flies to moon' },
  { name: 'KNEE DESTROYER', frames: 65, description: 'Breaks both knees then finishes' },
  { name: 'TORNADO KICK', frames: 70, description: 'Spinning kick tears head off' },
  { name: 'EXECUTION SLAM', frames: 80, description: 'Lifts and power bombs into ground' },
  { name: 'GUT SPILL', frames: 75, description: 'Slices open and organs fall out' },
  { name: 'PISTOL WHIP', frames: 55, description: 'Beats with gun then shoots point blank' },
  { name: 'NECK SNAP', frames: 50, description: 'Grabs and snaps neck 360 degrees' },
];

// ═══════════════════════════════════════════════════════
// FIGHTER
// ═══════════════════════════════════════════════════════
type FState = 'idle' | 'walk' | 'walkBack' | 'jump' | 'crouch' | 'slash' | 'heavySlash' | 'stab' | 'overhead' | 'jumpAtk' | 'uppercut' | 'spinSlash' | 'dashStab' | 'limbSmash' | 'backflipKick' | 'execution' | 'shoot' | 'wallRun' | 'wallJump' | 'wallFlip' | 'divekick' | 'kick' | 'headKick' | 'kneeStrike' | 'roundhouse' | 'headbutt' | 'swordThrow' | 'punch' | 'fatality' | 'block' | 'hit' | 'stagger' | 'ko' | 'ragdoll' | 'dodge' | 'taunt' | 'pickup' | 'skullFire' | 'dragonStrike';

// ═══════════════════════════════════════════════════════
// SPECIAL ATTACK ENTITIES (unified for all 12 types)
// ═══════════════════════════════════════════════════════
interface SpecialParticle { x: number; y: number; vx: number; vy: number; life: number; sz: number; color: string }
interface SpecialEntity {
  type: string; x: number; y: number; facing: 1 | -1;
  life: number; maxLife: number; owner: number;
  targetX: number; targetY: number;
  particles: SpecialParticle[];
  subEntities: { x: number; y: number; vx: number; vy: number; life: number; active: boolean; timer: number }[];
}

interface Weapon {
  name: string; len: number; weight: number;
  slashDmg: number; stabDmg: number; heavyDmg: number;
  speed: number; color: string; blade: string;
  type: 'sword' | 'axe' | 'spear' | 'greatsword';
}

const WEAPONS: Record<string, Weapon> = {
  longsword:  { name: 'Longsword',  len: 70,  weight: 1,   slashDmg: 12, stabDmg: 9,  heavyDmg: 20, speed: 1.3, color: '#888', blade: '#ccd', type: 'sword' },
  greatsword: { name: 'Greatsword', len: 95,  weight: 1.8, slashDmg: 16, stabDmg: 11, heavyDmg: 30, speed: 0.8, color: '#777', blade: '#aab', type: 'greatsword' },
  axe:        { name: 'Battle Axe', len: 65,  weight: 1.5, slashDmg: 14, stabDmg: 7,  heavyDmg: 28, speed: 0.9, color: '#654', blade: '#999', type: 'axe' },
  spear:      { name: 'Spear',      len: 110, weight: 0.8, slashDmg: 7,  stabDmg: 16, heavyDmg: 14, speed: 1.4, color: '#876', blade: '#bbc', type: 'spear' },
};

interface AtkDef { frames: number; hitStart: number; hitEnd: number; dmgKey: 'slashDmg' | 'stabDmg' | 'heavyDmg'; kb: V; stCost: number; canSever: boolean; isKick?: boolean; isHeadbutt?: boolean; isPunch?: boolean }
const ATK: Record<string, AtkDef> = {
  slash:        { frames: 18, hitStart: 5,  hitEnd: 11, dmgKey: 'slashDmg', kb: v(5, -1),   stCost: 8,  canSever: true },
  heavySlash:   { frames: 32, hitStart: 12, hitEnd: 22, dmgKey: 'heavyDmg', kb: v(12, -6),  stCost: 18, canSever: true },
  stab:         { frames: 14, hitStart: 5,  hitEnd: 10, dmgKey: 'stabDmg',  kb: v(4, 0),    stCost: 6,  canSever: false },
  overhead:     { frames: 30, hitStart: 14, hitEnd: 22, dmgKey: 'heavyDmg', kb: v(8, -10),  stCost: 16, canSever: true },
  jumpAtk:      { frames: 22, hitStart: 6,  hitEnd: 16, dmgKey: 'heavyDmg', kb: v(8, -8),   stCost: 14, canSever: true },
  uppercut:     { frames: 20, hitStart: 6,  hitEnd: 14, dmgKey: 'slashDmg', kb: v(3, -16),  stCost: 12, canSever: true },
  spinSlash:    { frames: 24, hitStart: 6,  hitEnd: 18, dmgKey: 'heavyDmg', kb: v(10, -4),  stCost: 15, canSever: true },
  dashStab:     { frames: 16, hitStart: 4,  hitEnd: 12, dmgKey: 'stabDmg',  kb: v(14, -2),  stCost: 10, canSever: false },
  limbSmash:    { frames: 26, hitStart: 8,  hitEnd: 18, dmgKey: 'heavyDmg', kb: v(14, -12), stCost: 14, canSever: true },
  backflipKick: { frames: 28, hitStart: 8,  hitEnd: 20, dmgKey: 'heavyDmg', kb: v(8, -18),  stCost: 16, canSever: true, isKick: true },
  execution:    { frames: 50, hitStart: 15, hitEnd: 40, dmgKey: 'heavyDmg', kb: v(4, -4),   stCost: 20, canSever: true },
  shoot:        { frames: 10, hitStart: 3,  hitEnd: 4,  dmgKey: 'stabDmg',  kb: v(6, -2),   stCost: 4,  canSever: false },
  wallFlip:     { frames: 24, hitStart: 6,  hitEnd: 18, dmgKey: 'heavyDmg', kb: v(12, -14), stCost: 14, canSever: true, isKick: true },
  divekick:     { frames: 20, hitStart: 4,  hitEnd: 16, dmgKey: 'heavyDmg', kb: v(10, 8),   stCost: 12, canSever: true, isKick: true },
  kick:         { frames: 16, hitStart: 4,  hitEnd: 12, dmgKey: 'stabDmg',  kb: v(8, -3),   stCost: 6,  canSever: false, isKick: true },
  headKick:     { frames: 20, hitStart: 6,  hitEnd: 14, dmgKey: 'heavyDmg', kb: v(6, -12),  stCost: 10, canSever: true, isKick: true },
  kneeStrike:   { frames: 14, hitStart: 3,  hitEnd: 10, dmgKey: 'stabDmg',  kb: v(3, -5),   stCost: 5,  canSever: false, isKick: true },
  roundhouse:   { frames: 22, hitStart: 6,  hitEnd: 16, dmgKey: 'heavyDmg', kb: v(14, -8),  stCost: 14, canSever: true, isKick: true },
  headbutt:     { frames: 16, hitStart: 4,  hitEnd: 10, dmgKey: 'stabDmg',  kb: v(10, -6),  stCost: 8,  canSever: false, isHeadbutt: true },
  swordThrow:   { frames: 20, hitStart: 6,  hitEnd: 8,  dmgKey: 'heavyDmg', kb: v(12, -4),  stCost: 5,  canSever: true },
  punch:        { frames: 12, hitStart: 3,  hitEnd: 8,  dmgKey: 'stabDmg',  kb: v(6, -2),   stCost: 4,  canSever: false, isPunch: true },
  fatality:     { frames: 80, hitStart: 10, hitEnd: 70, dmgKey: 'heavyDmg', kb: v(2, -2),   stCost: 0,  canSever: true },
  skullFire:    { frames: 90, hitStart: 20, hitEnd: 80, dmgKey: 'heavyDmg', kb: v(18, -8),  stCost: 40, canSever: true },
  dragonStrike: { frames: 80, hitStart: 15, hitEnd: 70, dmgKey: 'heavyDmg', kb: v(22, -12), stCost: 40, canSever: true },
};

interface Blood { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; sz: number; grounded: boolean }
interface Spark { x: number; y: number; vx: number; vy: number; life: number; color: string; sz: number }
interface Pool { x: number; y: number; r: number; a: number }
interface SevLimb { pts: V[]; vel: V; angV: number; ang: number; color: string; w: number; life: number; isHead: boolean; grounded: boolean; id: number }
interface GoreChunk { x: number; y: number; vx: number; vy: number; sz: number; life: number; rot: number; rotV: number; color: string }
interface Afterimage { x: number; y: number; pts: V[]; alpha: number; color: string }
interface ImpactRing { x: number; y: number; r: number; maxR: number; life: number; color: string }
interface Lightning { x1: number; y1: number; x2: number; y2: number; life: number; branches: V[][] }
interface Bullet { x: number; y: number; vx: number; vy: number; life: number; owner: number; dmg: number; trail: V[] }
interface MuzzleFlash { x: number; y: number; ang: number; life: number }
interface WallSpark { x: number; y: number; vx: number; vy: number; life: number }
interface FatalityText { text: string; life: number; maxLife: number }

let limbIdCounter = 0;

interface ThrownSword { x: number; y: number; vx: number; vy: number; ang: number; angV: number; life: number; dmg: number; owner: number; weapon: Weapon; stuck: boolean }

interface Fighter {
  x: number; y: number; vx: number; vy: number;
  hp: number; stamina: number;
  state: FState; frame: number; dur: number;
  facing: 1 | -1; grounded: boolean;
  weapon: Weapon;
  combo: number; comboTimer: number;
  name: string; color: string; skin: string; hair: string;
  isAI: boolean; wins: number;
  aiTimer: number;
  walkCycle: number; bob: number;
  rag: { pts: RPoint[]; sticks: RStick[] };
  ragdolling: boolean; ragTimer: number;
  severed: Set<string>; bleedTimer: number;
  wAngle: number; wTarget: number; hitDealt: boolean;
  hitDir: V; hitImpact: number;
  dodgeCool: number;
  heldLimb: SevLimb | null;
  limbSwingAng: number;
  wallRunTimer: number;
  wallSide: -1 | 0 | 1;
  gunCooldown: number;
  muzzleFlash: number;
  headHits: number;
  shieldHP: number;
  fatalityType: number;
  hasSword: boolean;
  groundBeatTimer: number;
  specialCooldown: number;
  charId: string;
}

function mkFighterFromChar(x: number, charDef: CharacterDef, isAI: boolean): Fighter {
  return {
    x, y: GY, vx: 0, vy: 0, hp: MAX_HP, stamina: 100,
    state: 'idle', frame: 0, dur: 0, facing: 1, grounded: true,
    weapon: WEAPONS[charDef.weaponKey] || WEAPONS.longsword, combo: 0, comboTimer: 0,
    name: charDef.name, color: charDef.color, skin: charDef.skin, hair: charDef.hair,
    isAI, wins: 0, aiTimer: 0,
    walkCycle: 0, bob: Math.random() * 6.28,
    rag: createRagdoll(x, GY), ragdolling: false, ragTimer: 0,
    severed: new Set(), bleedTimer: 0,
    wAngle: -0.5, wTarget: -0.5, hitDealt: false,
    hitDir: v(), hitImpact: 0, dodgeCool: 0,
    heldLimb: null, limbSwingAng: 0,
    wallRunTimer: 0, wallSide: 0, gunCooldown: 0, muzzleFlash: 0,
    headHits: 0, shieldHP: 50, fatalityType: 0,
    hasSword: true, groundBeatTimer: 0,
    specialCooldown: 300 + Math.floor(rng(0, 200)),
    charId: charDef.id,
  };
}

function poseRagdoll(f: Fighter) {
  const r = f.rag;
  const s = f.facing;
  const S = 1.35;
  const isIdle = f.state === 'idle';
  const bob2 = isIdle ? Math.sin(f.bob) * 2 : 0;
  const breathe = isIdle ? Math.sin(f.bob * 1.2) * 1.5 : 0;
  const sway = isIdle ? Math.sin(f.bob * 0.7) * 3 : 0;
  const weightShift = isIdle ? Math.sin(f.bob * 0.5) * 2 : 0;
  const armIdle = isIdle ? Math.sin(f.bob * 0.9) * 4 : 0;
  const co = f.state === 'crouch' ? 15 : 0;
  const wk = f.state === 'walk' || f.state === 'walkBack' ? f.walkCycle : 0;
  const ap = f.dur > 0 ? f.frame / f.dur : 0;
  const jmp = !f.grounded ? -10 : 0;
  const legSwing = Math.sin(wk) * 14 * S;
  const legBend = Math.abs(Math.sin(wk)) * 8 * S;

  // Spine bend - dynamic mid-back flex based on action
  let spineBend = 0;
  if (f.state === 'slash' || f.state === 'heavySlash') spineBend = Math.sin(ap * Math.PI) * 8 * s;
  else if (f.state === 'uppercut') spineBend = -12 * s * ap;
  else if (f.state === 'kick' || f.state === 'headKick' || f.state === 'roundhouse') spineBend = -6 * s * Math.sin(ap * Math.PI);
  else if (f.state === 'headbutt') spineBend = 15 * s * (ap < 0.5 ? -ap : ap - 1);
  else if (f.state === 'stagger' || f.state === 'hit') spineBend = -8 * f.hitDir.x;
  else if (f.state === 'dodge') spineBend = Math.sin(ap * Math.PI * 2) * 10 * s;
  else if (isIdle) spineBend = Math.sin(f.bob * 0.4) * 2;
  else if (f.state === 'walk') spineBend = Math.sin(wk * 2) * 3 * s;

  const lHipX = -10 * s * S, rHipX = 10 * s * S;
  const hipY = -33 * S + jmp;
  const footY = 4; // Longer legs - feet extend slightly below reference
  const lFootX = (lHipX - legSwing * 0.8 * s);
  const rFootX = (rHipX + legSwing * 0.8 * s);
  const lKneeX = (lHipX + lFootX) / 2 + s * 5 * S;
  const lKneeY = (hipY + footY) / 2 - legBend - 6 * S;
  const rKneeX = (rHipX + rFootX) / 2 + s * 5 * S;
  const rKneeY = (hipY + footY) / 2 - legBend - 6 * S;

  const targets: V[] = [
    v(sway * 0.5 + spineBend * 0.3, -108 * S + bob2 + co + jmp + breathe * 0.3),
    v(sway * 0.4 + spineBend * 0.25, -93 * S + bob2 + co + jmp + breathe * 0.5),
    v(sway * 0.3 + spineBend * 0.5, -72 * S + bob2 + co + jmp + breathe), // mid-spine bends!
    v(sway * 0.2 + spineBend * 0.8, -52 * S + co + jmp + breathe * 0.5), // lower spine bends more!
    v(weightShift + spineBend * 0.2, hipY),
    v(-15 * s * S + armIdle * 0.3, -86 * S + bob2 + co + jmp + breathe * 0.4), v(-28 * s * S + armIdle * 0.6, -64 * S + bob2 + co + jmp + armIdle * 0.5), v(-35 * s * S + armIdle, -46 * S + bob2 + co + jmp + armIdle * 0.8),
    v(15 * s * S - armIdle * 0.2, -86 * S + bob2 + co + jmp + breathe * 0.4), v(28 * s * S - armIdle * 0.4, -64 * S + bob2 + co + jmp - armIdle * 0.3), v(35 * s * S - armIdle * 0.5, -46 * S + bob2 + co + jmp - armIdle * 0.5),
    v(lHipX + weightShift, hipY), v(lKneeX + weightShift * 0.5, lKneeY + jmp), v(lFootX + weightShift * 0.3, footY),
    v(rHipX - weightShift, hipY), v(rKneeX - weightShift * 0.5, rKneeY + jmp), v(rFootX - weightShift * 0.3, footY),
  ];

  if (f.hitImpact > 0) {
    const hd = f.hitDir; const imp = f.hitImpact;
    for (let i = 0; i < 11; i++) targets[i] = vadd(targets[i], vscl(hd, imp * (1 - i * 0.06)));
  }

  if (f.state === 'dodge') {
    const roll = ap * Math.PI * 2;
    for (let i = 0; i < targets.length; i++) { targets[i].y += Math.sin(roll) * 20; targets[i].x += Math.cos(roll) * 5 * s; }
  }

  // ── KICK POSES ──
  if (f.state === 'kick') {
    const bendPhase = ap < 0.3 ? ap / 0.3 : ap < 0.6 ? 1 : 1 - (ap - 0.6) / 0.4;
    const extendPhase = ap < 0.3 ? 0 : ap < 0.6 ? (ap - 0.3) / 0.3 : 1 - (ap - 0.6) / 0.4;
    targets[14] = v(rHipX + s * 10 * extendPhase, hipY - 35 * bendPhase);
    targets[15] = v(rHipX + s * 35 * extendPhase, hipY - 18 * bendPhase - 12 * extendPhase);
    targets[16] = v(rHipX + s * 60 * extendPhase, hipY - 5 * bendPhase + 8 * (1 - extendPhase));
    targets[12] = v(lKneeX, lKneeY + 5);
    targets[13] = v(lFootX, footY);
  }

  if (f.state === 'headKick') {
    const windUp = ap < 0.25 ? ap / 0.25 : 0;
    const kickUp = ap < 0.25 ? 0 : ap < 0.55 ? (ap - 0.25) / 0.3 : 1;
    const recover = ap > 0.7 ? (ap - 0.7) / 0.3 : 0;
    targets[14] = v(rHipX + s * 5, hipY + 5 * windUp - 25 * kickUp + 18 * recover);
    targets[15] = v(rHipX + s * 25 * kickUp, hipY - 35 * kickUp - 25 * windUp + 22 * recover);
    targets[16] = v(rHipX + s * 55 * kickUp, -85 * S * kickUp + footY * (1 - kickUp) + 35 * recover);
    for (let i = 0; i < 5; i++) targets[i].x -= s * 8 * kickUp;
    targets[12] = v(lKneeX - s * 5, lKneeY + 8 * kickUp);
  }

  if (f.state === 'kneeStrike') {
    const drivePhase = ap < 0.2 ? ap / 0.2 : ap < 0.5 ? 1 : 1 - (ap - 0.5) / 0.5;
    targets[14] = v(rHipX + s * 28 * drivePhase, hipY - 30 * drivePhase);
    targets[15] = v(rHipX + s * 35 * drivePhase, hipY - 40 * drivePhase);
    targets[16] = v(rHipX + s * 18 * drivePhase, hipY - 18 * drivePhase);
    for (let i = 0; i < 5; i++) targets[i].x += s * 10 * drivePhase;
  }

  if (f.state === 'roundhouse') {
    const spinPhase = ap * Math.PI * 1.5;
    const height = Math.sin(ap * Math.PI) * 70;
    const bodyTwist = Math.sin(spinPhase) * 12;
    for (let i = 0; i < 5; i++) targets[i].x += bodyTwist;
    targets[14] = v(rHipX + Math.cos(spinPhase) * 22 * s, hipY - 30);
    targets[15] = v(rHipX + Math.cos(spinPhase) * 45 * s, hipY - 45 - height * 0.3);
    targets[16] = v(rHipX + Math.cos(spinPhase) * 65 * s, -75 * S - height * 0.5);
    targets[12] = v(lKneeX, lKneeY + 5);
    targets[13] = v(lFootX, footY);
  }

  // ── HEADBUTT POSE ──
  if (f.state === 'headbutt') {
    const windUp = ap < 0.25 ? ap / 0.25 : 0;
    const strike = ap < 0.25 ? 0 : ap < 0.5 ? (ap - 0.25) / 0.25 : 1;
    const recover = ap > 0.6 ? (ap - 0.6) / 0.4 : 0;
    for (let i = 0; i < 5; i++) {
      targets[i].x -= s * 12 * windUp;
      targets[i].x += s * 25 * strike - s * 10 * recover;
    }
    targets[0] = v(sway + s * 30 * strike - s * 5 * recover, -108 * S + bob2 + 15 * strike);
    targets[1] = v(sway + s * 15 * strike, -93 * S + bob2 + 8 * strike);
    targets[12] = v(lKneeX - s * 5 * strike, lKneeY + 5 * strike);
    targets[15] = v(rKneeX + s * 5 * strike, rKneeY + 5 * strike);
  }

  // ── PUNCH POSE ──
  if (f.state === 'punch') {
    const windUp = ap < 0.2 ? ap / 0.2 : 0;
    const strike = ap < 0.2 ? 0 : ap < 0.5 ? (ap - 0.2) / 0.3 : 1;
    const recover = ap > 0.6 ? (ap - 0.6) / 0.4 : 0;
    targets[8] = v((15 + 20 * strike - 10 * recover) * s * S, (-86 + 10 * windUp) * S + bob2);
    targets[9] = v((28 + 35 * strike - 15 * recover) * s * S, (-64 + 15 * strike - 5 * recover) * S + bob2);
    targets[10] = v((35 + 50 * strike - 20 * recover) * s * S, (-55 + 20 * strike - 8 * recover) * S + bob2);
    for (let i = 0; i < 5; i++) targets[i].x += s * 8 * strike - s * 3 * recover;
  }

  // ── SWORD THROW POSE ──
  if (f.state === 'swordThrow') {
    const windUp = ap < 0.3 ? ap / 0.3 : 0;
    const release = ap < 0.3 ? 0 : ap < 0.5 ? (ap - 0.3) / 0.2 : 1;
    targets[8] = v((15 - 25 * windUp + 30 * release) * s * S, (-86 - 15 * windUp + 10 * release) * S);
    targets[9] = v((28 - 30 * windUp + 40 * release) * s * S, (-64 - 20 * windUp + 15 * release) * S);
    targets[10] = v((35 - 35 * windUp + 50 * release) * s * S, (-46 - 25 * windUp + 20 * release) * S);
    for (let i = 0; i < 5; i++) targets[i].x += s * (-8 * windUp + 12 * release);
  }

  if (f.state === 'fatality') {
    const ft = f.fatalityType % 5;
    const subAp = (ap * 4) % 1;
    if (ft === 0) {
      targets[9] = v((28 + 30 * (ap > 0.4 ? 1 : 0)) * s * S, (-64 - 20 * (ap > 0.4 ? 1 : 0)) * S);
      targets[10] = v((35 + 40 * (ap > 0.4 ? 1 : 0)) * s * S, (-46 - 30 * (ap > 0.4 ? 1 : 0)) * S);
    } else if (ft === 1) {
      const stompH = subAp < 0.3 ? -50 : subAp < 0.5 ? 20 : -30;
      targets[15] = v(s * 22, stompH);
      targets[16] = v(s * 28, stompH + 18);
      for (let i = 0; i < 5; i++) targets[i].y += Math.sin(subAp * Math.PI) * 10;
    } else if (ft === 2) {
      const spinA = ap * Math.PI * 4;
      for (let i = 0; i < targets.length; i++) {
        const cx = 0, cy = -60 * S;
        const dx2 = targets[i].x - cx, dy2 = targets[i].y - cy;
        targets[i].x = cx + dx2 * Math.cos(spinA * 0.3) - dy2 * Math.sin(spinA * 0.3);
        targets[i].y = cy + dx2 * Math.sin(spinA * 0.3) + dy2 * Math.cos(spinA * 0.3);
      }
    } else if (ft === 3) {
      const smashPhase = subAp < 0.4 ? subAp / 0.4 : 1 - (subAp - 0.4) / 0.6;
      targets[9] = v(30 * s * S, (-50 + 60 * smashPhase) * S);
      targets[10] = v(40 * s * S, (-35 + 50 * smashPhase) * S);
    } else {
      if (ap < 0.5) {
        const knee = ap * 2;
        targets[15] = v(s * 35 * knee, -40 * S * knee);
      } else {
        const kickPhase = (ap - 0.5) * 2;
        targets[16] = v(s * 60 * kickPhase, -95 * S * kickPhase);
        targets[15] = v(s * 40 * kickPhase, -75 * S * kickPhase);
      }
    }
  }

  if (f.state === 'wallRun') {
    const ws = f.wallSide;
    const runCycle = f.walkCycle * 2;
    const legA = Math.sin(runCycle) * 28;
    const legB = Math.cos(runCycle) * 28;
    for (let i = 0; i < 5; i++) targets[i].x += ws * 15;
    targets[6] = v((-28 - 10) * s * S, (-64 - 20) * S);
    targets[7] = v((-35 - 15) * s * S, (-46 - 25) * S);
    targets[9] = v((28 + 10) * s * S, (-64 - 20) * S);
    targets[10] = v((35 + 15) * s * S, (-46 - 25) * S);
    targets[12] = v(lKneeX + ws * 8, -22 + legA);
    targets[13] = v(lFootX + ws * 12, -5 + legA * 1.5);
    targets[15] = v(rKneeX + ws * 8, -22 + legB);
    targets[16] = v(rFootX + ws * 12, -5 + legB * 1.5);
  }

  if (f.state === 'wallFlip') {
    const flipAng = ap * Math.PI * 2.5;
    const flipH = Math.sin(ap * Math.PI) * 100;
    const flipX = f.facing * ap * 80;
    for (let i = 0; i < targets.length; i++) {
      const cx = 0, cy = -60 * S;
      const dx2 = targets[i].x - cx, dy2 = targets[i].y - cy;
      targets[i].x = cx + dx2 * Math.cos(flipAng) - dy2 * Math.sin(flipAng) + flipX;
      targets[i].y = cy + dx2 * Math.sin(flipAng) + dy2 * Math.cos(flipAng) - flipH;
    }
    if (ap > 0.25 && ap < 0.65) {
      targets[16] = v(f.facing * 65 * S, -95 * S - flipH * 0.5);
      targets[15] = v(f.facing * 45 * S, -75 * S - flipH * 0.5);
    }
  }

  if (f.state === 'divekick') {
    for (let i = 0; i < 5; i++) { targets[i].x += f.facing * 20 * ap; targets[i].y -= 10; }
    targets[15] = v(f.facing * 55 * S, 12 + 35 * ap);
    targets[16] = v(f.facing * 70 * S, 22 + 45 * ap);
    targets[12] = v(-f.facing * 5 * S, -45 * S);
    targets[13] = v(-f.facing * 10 * S, -28 * S);
  }

  if (f.state === 'shoot') {
    targets[6] = v((-28 + 25 * s) * S, (-70) * S + bob2);
    targets[7] = v((-35 + 55 * s) * S, (-65) * S + bob2);
    if (ap > 0.2 && ap < 0.5) targets[7] = vadd(targets[7], v(-s * 8, -5));
  }

  if (['slash', 'heavySlash', 'stab', 'overhead', 'jumpAtk', 'uppercut', 'spinSlash', 'dashStab', 'limbSmash', 'backflipKick', 'execution'].includes(f.state)) {
    const reach = ap < 0.3 ? -15 : ap < 0.6 ? 28 : 10;
    const lift = ap < 0.3 ? -25 : ap < 0.6 ? 5 : -5;
    targets[9] = v((28 + reach) * s * S, (-64 + lift) * S + bob2 + co + jmp);
    targets[10] = v((35 + reach * 1.3) * s * S, (-46 + lift) * S + bob2 + co + jmp);
    if (f.state === 'uppercut') {
      const uLift = ap < 0.25 ? 0 : ap < 0.5 ? -30 : -15;
      targets[9] = v((20 + reach * 0.6) * s * S, (-74 + uLift) * S + bob2 + jmp);
      targets[10] = v((25 + reach * 0.8) * s * S, (-56 + uLift) * S + bob2 + jmp);
    }
    if (f.state === 'spinSlash') {
      const spinAng = ap * Math.PI * 2;
      const sx2 = Math.cos(spinAng) * 30, sy2 = Math.sin(spinAng) * 15;
      targets[9] = v((28 + sx2) * s * S, (-64 + sy2) * S + bob2 + jmp);
      targets[10] = v((35 + sx2 * 1.2) * s * S, (-46 + sy2) * S + bob2 + jmp);
    }
    if (f.state === 'dashStab') {
      targets[9] = v((30 + reach * 1.5) * s * S, -70 * S + bob2 + jmp);
      targets[10] = v((40 + reach * 1.8) * s * S, -62 * S + bob2 + jmp);
    }
    if (f.state === 'limbSmash' && f.heldLimb) {
      const limbReach = ap < 0.25 ? -20 : ap < 0.55 ? 35 : 5;
      const limbLift = ap < 0.25 ? -35 : ap < 0.55 ? 10 : -10;
      targets[6] = v((-28 + limbReach) * s * S, (-64 + limbLift) * S + bob2 + co + jmp);
      targets[7] = v((-35 + limbReach * 1.3) * s * S, (-46 + limbLift) * S + bob2 + co + jmp);
    }
    if (f.state === 'backflipKick') {
      const flipAng = ap * Math.PI * 2;
      const flipH = Math.sin(flipAng) * 70;
      const flipX = -Math.cos(flipAng) * 25 * s;
      for (let i = 0; i < targets.length; i++) {
        const cx = 0, cy = -60 * S;
        const dx2 = targets[i].x - cx, dy2 = targets[i].y - cy;
        targets[i].x = cx + dx2 * Math.cos(flipAng) - dy2 * Math.sin(flipAng) + flipX;
        targets[i].y = cy + dx2 * Math.sin(flipAng) + dy2 * Math.cos(flipAng) + flipH - 50;
      }
      if (ap > 0.3 && ap < 0.7) {
        targets[16] = v(s * 60 * S, -95 * S + flipH);
        targets[15] = v(s * 40 * S, -75 * S + flipH);
      }
    }
    if (f.state === 'execution') {
      const subAp = (ap * 5) % 1;
      const slamDown = subAp < 0.4 ? -40 + subAp * 100 : subAp < 0.6 ? 0 : -20;
      targets[9] = v(30 * s * S, (-50 + slamDown) * S);
      targets[10] = v(40 * s * S, (-35 + slamDown) * S);
      const bodyBob = Math.sin(subAp * Math.PI) * 15;
      for (let i = 0; i < 5; i++) targets[i].y += bodyBob;
    }
  }

  if (f.state === 'pickup') {
    targets[6] = v(-10 * s, -20 + bob2); targets[7] = v(-5 * s, 0);
    targets[9] = v(10 * s, -20 + bob2); targets[10] = v(5 * s, 0);
    targets[0] = v(0, -85 + bob2 + co);
  }

  if (f.state === 'block') {
    targets[5] = v(-10 * s * S, -80 * S + bob2 + co);
    targets[6] = v(5 * s * S, -72 * S + bob2 + co);
    targets[7] = v(12 * s * S, -62 * S + bob2 + co);
    targets[9] = v(18 * s, -80 + bob2 + co); targets[10] = v(22 * s, -62 + bob2 + co);
  }

  if (f.state === 'taunt') {
    targets[9] = v(20 * s, -90 + bob2); targets[10] = v(25 * s, -100 + bob2);
    targets[6] = v(-20 * s, -90 + bob2); targets[7] = v(-25 * s, -100 + bob2);
  }

  for (let i = 0; i < targets.length; i++) {
    if (f.y + targets[i].y > GY) targets[i].y = GY - f.y;
  }

  // Use softer blend for smoother transitions, especially during KO/fatality
  const isKoState = f.state === 'ko' || f.state === 'fatality';
  const blend = f.ragdolling ? 0 : isKoState ? 0.2 : 0.3;
  for (let i = 0; i < r.pts.length && i < targets.length; i++) {
    const target = vadd(v(f.x, f.y), targets[i]);
    const b = (i >= 11) ? Math.min(blend * 1.2, 0.45) : blend;
    r.pts[i].pos = vlerp(r.pts[i].pos, target, b);
    if (!f.ragdolling) r.pts[i].old = vlerp(r.pts[i].old, target, b * 0.7);
  }
}

// ═══════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════
type GameScreen = 'menu' | 'settings' | 'fight' | 'charSelect' | 'campaignSelect' | 'cinematic' | 'campaignFight' | 'victory';
type SettingsTab = 'general' | 'controls' | 'gameplay' | 'display';

// ═══════════════════════════════════════════════════════
// GAMEPAD SUPPORT (PS4/generic)
// ═══════════════════════════════════════════════════════
const GAMEPAD_BUTTONS = {
  cross: 0, circle: 1, square: 2, triangle: 3,
  L1: 4, R1: 5, L2: 6, R2: 7,
  share: 8, options: 9,
  L3: 10, R3: 11,
  up: 12, down: 13, left: 14, right: 15,
};

interface GamepadState {
  left: boolean; right: boolean; up: boolean; down: boolean;
  slash: boolean; heavySlash: boolean; kick: boolean; block: boolean;
  special: boolean; dodge: boolean; shoot: boolean; grab: boolean;
  analogX: number; analogY: number;
  confirm: boolean; back: boolean; start: boolean;
}

function readGamepad(deadzone = 0.15): GamepadState {
  const gp = navigator.getGamepads?.()[0];
  if (!gp) return { left: false, right: false, up: false, down: false, slash: false, heavySlash: false, kick: false, block: false, special: false, dodge: false, shoot: false, grab: false, analogX: 0, analogY: 0, confirm: false, back: false, start: false };
  let ax0 = gp.axes[0] ?? 0;
  let ax1 = gp.axes[1] ?? 0;
  // Apply deadzone
  if (Math.abs(ax0) < deadzone) ax0 = 0;
  if (Math.abs(ax1) < deadzone) ax1 = 0;
  return {
    left: ax0 < -deadzone || gp.buttons[GAMEPAD_BUTTONS.left]?.pressed,
    right: ax0 > deadzone || gp.buttons[GAMEPAD_BUTTONS.right]?.pressed,
    up: ax1 < -deadzone || gp.buttons[GAMEPAD_BUTTONS.up]?.pressed,
    down: ax1 > deadzone || gp.buttons[GAMEPAD_BUTTONS.down]?.pressed,
    analogX: ax0,
    analogY: ax1,
    slash: gp.buttons[GAMEPAD_BUTTONS.square]?.pressed,
    heavySlash: gp.buttons[GAMEPAD_BUTTONS.triangle]?.pressed,
    kick: gp.buttons[GAMEPAD_BUTTONS.circle]?.pressed,
    block: gp.buttons[GAMEPAD_BUTTONS.L1]?.pressed,
    special: gp.buttons[GAMEPAD_BUTTONS.R1]?.pressed && gp.buttons[GAMEPAD_BUTTONS.R2]?.pressed,
    dodge: gp.buttons[GAMEPAD_BUTTONS.cross]?.pressed && (Math.abs(ax0) > deadzone),
    shoot: gp.buttons[GAMEPAD_BUTTONS.R2]?.pressed && !gp.buttons[GAMEPAD_BUTTONS.R1]?.pressed,
    grab: gp.buttons[GAMEPAD_BUTTONS.L2]?.pressed,
    confirm: gp.buttons[GAMEPAD_BUTTONS.cross]?.pressed,
    back: gp.buttons[GAMEPAD_BUTTONS.circle]?.pressed,
    start: gp.buttons[GAMEPAD_BUTTONS.options]?.pressed,
  };
}

// Gamepad menu navigation state (prevents repeat)
let gpMenuPrev = { up: false, down: false, left: false, right: false, confirm: false, back: false, start: false };

// ═══════════════════════════════════════════════════════
// CAMPAIGN STATE
// ═══════════════════════════════════════════════════════
interface CampaignState {
  level: number;
  playerCharId: string;
  totalScore: number;
  levelScores: number[];
  totalDamageDealt: number;
  totalCombos: number;
  bestCombo: number;
  totalTime: number;
  levelsComplete: boolean[];
}
// ═══════════════════════════════════════════════════════
// SHARED CHARACTER PREVIEW RENDERER
// ═══════════════════════════════════════════════════════
const drawCharPreview = (ctx2d: CanvasRenderingContext2D, charDef: CharacterDef, cx: number, cy: number, scale: number, selected: boolean) => {
  const s = scale;
  ctx2d.save();
  ctx2d.translate(cx, cy);

  // Ground shadow
  ctx2d.fillStyle = 'rgba(0,0,0,0.3)';
  ctx2d.beginPath(); ctx2d.ellipse(0, 38 * s, 22 * s, 6 * s, 0, 0, Math.PI * 2); ctx2d.fill();

  // Aura glow
  if (charDef.glowColor) {
    const aGlow = ctx2d.createRadialGradient(0, -20 * s, 5 * s, 0, -20 * s, 50 * s);
    aGlow.addColorStop(0, charDef.glowColor + '40');
    aGlow.addColorStop(1, 'transparent');
    ctx2d.fillStyle = aGlow;
    ctx2d.beginPath(); ctx2d.arc(0, -20 * s, 50 * s, 0, Math.PI * 2); ctx2d.fill();
  }

  // Cape
  if (charDef.capeColor) {
    ctx2d.fillStyle = charDef.capeColor;
    ctx2d.beginPath();
    ctx2d.moveTo(-8 * s, -40 * s);
    ctx2d.quadraticCurveTo(-15 * s, 10 * s, -10 * s, 30 * s);
    ctx2d.lineTo(10 * s, 30 * s);
    ctx2d.quadraticCurveTo(15 * s, 10 * s, 8 * s, -40 * s);
    ctx2d.fill();
  }

  // Legs
  ctx2d.strokeStyle = charDef.color; ctx2d.lineWidth = 7 * s; ctx2d.lineCap = 'round';
  ctx2d.beginPath(); ctx2d.moveTo(0, 0); ctx2d.lineTo(-10 * s, 35 * s); ctx2d.stroke();
  ctx2d.beginPath(); ctx2d.moveTo(0, 0); ctx2d.lineTo(10 * s, 35 * s); ctx2d.stroke();
  // Boots
  ctx2d.fillStyle = '#333';
  ctx2d.beginPath(); ctx2d.ellipse(-10 * s, 37 * s, 8 * s, 4 * s, 0, 0, Math.PI * 2); ctx2d.fill();
  ctx2d.beginPath(); ctx2d.ellipse(10 * s, 37 * s, 8 * s, 4 * s, 0, 0, Math.PI * 2); ctx2d.fill();

  // Torso
  ctx2d.strokeStyle = charDef.color; ctx2d.lineWidth = 10 * s;
  ctx2d.beginPath(); ctx2d.moveTo(0, 0); ctx2d.lineTo(0, -35 * s); ctx2d.stroke();

  // Armor detail
  if (charDef.armorType === 'heavy') {
    ctx2d.strokeStyle = charDef.color2; ctx2d.lineWidth = 12 * s;
    ctx2d.beginPath(); ctx2d.moveTo(-12 * s, -30 * s); ctx2d.lineTo(12 * s, -30 * s); ctx2d.stroke();
    ctx2d.fillStyle = charDef.color2;
    ctx2d.fillRect(-6 * s, -28 * s, 12 * s, 20 * s);
  } else if (charDef.armorType === 'medium') {
    ctx2d.strokeStyle = charDef.color2; ctx2d.lineWidth = 2 * s;
    ctx2d.beginPath(); ctx2d.moveTo(-8 * s, -32 * s); ctx2d.lineTo(8 * s, -32 * s); ctx2d.stroke();
    ctx2d.beginPath(); ctx2d.moveTo(-6 * s, -22 * s); ctx2d.lineTo(6 * s, -22 * s); ctx2d.stroke();
  } else if (charDef.armorType === 'robe') {
    ctx2d.fillStyle = charDef.color + 'cc';
    ctx2d.beginPath();
    ctx2d.moveTo(-12 * s, -35 * s); ctx2d.lineTo(-16 * s, 30 * s);
    ctx2d.lineTo(16 * s, 30 * s); ctx2d.lineTo(12 * s, -35 * s);
    ctx2d.fill();
  }

  // Tattoos
  if (charDef.tattooColor) {
    ctx2d.strokeStyle = charDef.tattooColor + '80'; ctx2d.lineWidth = 1.5 * s;
    ctx2d.beginPath(); ctx2d.arc(0, -18 * s, 6 * s, 0, Math.PI); ctx2d.stroke();
    ctx2d.beginPath(); ctx2d.moveTo(-4 * s, -15 * s); ctx2d.lineTo(-8 * s, -8 * s); ctx2d.stroke();
    ctx2d.beginPath(); ctx2d.moveTo(4 * s, -15 * s); ctx2d.lineTo(8 * s, -8 * s); ctx2d.stroke();
  }

  // Arms
  ctx2d.strokeStyle = charDef.skin; ctx2d.lineWidth = 5 * s; ctx2d.lineCap = 'round';
  ctx2d.beginPath(); ctx2d.moveTo(-12 * s, -30 * s); ctx2d.lineTo(-20 * s, -10 * s); ctx2d.stroke();
  ctx2d.beginPath(); ctx2d.moveTo(12 * s, -30 * s); ctx2d.lineTo(20 * s, -15 * s); ctx2d.stroke();

  // Weapon in right hand
  const wep = charDef.weaponKey;
  ctx2d.strokeStyle = '#aaa'; ctx2d.lineWidth = 3 * s;
  if (wep === 'greatsword') {
    ctx2d.strokeStyle = '#bbc'; ctx2d.lineWidth = 4 * s;
    ctx2d.beginPath(); ctx2d.moveTo(20 * s, -15 * s); ctx2d.lineTo(28 * s, -55 * s); ctx2d.stroke();
    ctx2d.strokeStyle = charDef.color2; ctx2d.lineWidth = 2 * s;
    ctx2d.beginPath(); ctx2d.moveTo(16 * s, -15 * s); ctx2d.lineTo(24 * s, -15 * s); ctx2d.stroke();
  } else if (wep === 'axe') {
    ctx2d.beginPath(); ctx2d.moveTo(20 * s, -15 * s); ctx2d.lineTo(26 * s, -50 * s); ctx2d.stroke();
    ctx2d.fillStyle = '#888';
    ctx2d.beginPath(); ctx2d.moveTo(22 * s, -48 * s); ctx2d.lineTo(32 * s, -55 * s); ctx2d.lineTo(32 * s, -42 * s); ctx2d.closePath(); ctx2d.fill();
  } else if (wep === 'spear') {
    ctx2d.lineWidth = 2.5 * s;
    ctx2d.beginPath(); ctx2d.moveTo(20 * s, -15 * s); ctx2d.lineTo(24 * s, -60 * s); ctx2d.stroke();
    ctx2d.fillStyle = '#ccd';
    ctx2d.beginPath(); ctx2d.moveTo(24 * s, -60 * s); ctx2d.lineTo(21 * s, -52 * s); ctx2d.lineTo(27 * s, -52 * s); ctx2d.closePath(); ctx2d.fill();
  } else if (wep === 'dagger') {
    ctx2d.lineWidth = 2 * s;
    ctx2d.beginPath(); ctx2d.moveTo(20 * s, -15 * s); ctx2d.lineTo(25 * s, -35 * s); ctx2d.stroke();
    // Second dagger in left hand
    ctx2d.beginPath(); ctx2d.moveTo(-20 * s, -10 * s); ctx2d.lineTo(-25 * s, -30 * s); ctx2d.stroke();
  } else if (wep === 'hammer') {
    ctx2d.lineWidth = 3.5 * s;
    ctx2d.beginPath(); ctx2d.moveTo(20 * s, -15 * s); ctx2d.lineTo(26 * s, -50 * s); ctx2d.stroke();
    ctx2d.fillStyle = '#777';
    ctx2d.fillRect(20 * s, -56 * s, 14 * s, 10 * s);
  } else if (wep === 'scythe') {
    ctx2d.lineWidth = 2.5 * s;
    ctx2d.beginPath(); ctx2d.moveTo(20 * s, -15 * s); ctx2d.lineTo(22 * s, -55 * s); ctx2d.stroke();
    ctx2d.strokeStyle = '#aab'; ctx2d.lineWidth = 2 * s;
    ctx2d.beginPath(); ctx2d.moveTo(22 * s, -55 * s); ctx2d.quadraticCurveTo(35 * s, -55 * s, 30 * s, -40 * s); ctx2d.stroke();
  } else if (wep === 'staff') {
    ctx2d.strokeStyle = '#886644'; ctx2d.lineWidth = 3 * s;
    ctx2d.beginPath(); ctx2d.moveTo(20 * s, -15 * s); ctx2d.lineTo(22 * s, -60 * s); ctx2d.stroke();
    // Orb on top
    const orbGlow = ctx2d.createRadialGradient(22 * s, -62 * s, 2, 22 * s, -62 * s, 8 * s);
    orbGlow.addColorStop(0, charDef.specialColor); orbGlow.addColorStop(1, 'transparent');
    ctx2d.fillStyle = orbGlow; ctx2d.beginPath(); ctx2d.arc(22 * s, -62 * s, 8 * s, 0, Math.PI * 2); ctx2d.fill();
    ctx2d.fillStyle = charDef.specialColor; ctx2d.beginPath(); ctx2d.arc(22 * s, -62 * s, 3 * s, 0, Math.PI * 2); ctx2d.fill();
  } else {
    ctx2d.beginPath(); ctx2d.moveTo(20 * s, -15 * s); ctx2d.lineTo(26 * s, -48 * s); ctx2d.stroke();
  }

  // Head
  const hs = charDef.headScale;
  ctx2d.fillStyle = charDef.hair;
  ctx2d.beginPath(); ctx2d.arc(0, -45 * s, 14 * s * hs, Math.PI * 1.1, -0.1 * Math.PI); ctx2d.fill();
  ctx2d.fillStyle = charDef.skin;
  ctx2d.beginPath(); ctx2d.arc(0, -45 * s, 12 * s * hs, 0, Math.PI * 2); ctx2d.fill();

  // Helmet/headgear
  if (charDef.helmetType === 'crown') {
    ctx2d.fillStyle = '#daa520';
    ctx2d.fillRect(-10 * s * hs, -58 * s, 20 * s * hs, 5 * s);
    for (let i = -2; i <= 2; i++) ctx2d.fillRect((i * 4 - 1) * s * hs, -62 * s, 3 * s * hs, 4 * s);
  } else if (charDef.helmetType === 'horns') {
    ctx2d.strokeStyle = '#888'; ctx2d.lineWidth = 3 * s;
    ctx2d.beginPath(); ctx2d.moveTo(-10 * s * hs, -52 * s); ctx2d.quadraticCurveTo(-18 * s * hs, -70 * s, -12 * s * hs, -72 * s); ctx2d.stroke();
    ctx2d.beginPath(); ctx2d.moveTo(10 * s * hs, -52 * s); ctx2d.quadraticCurveTo(18 * s * hs, -70 * s, 12 * s * hs, -72 * s); ctx2d.stroke();
  } else if (charDef.helmetType === 'hood') {
    ctx2d.fillStyle = charDef.color;
    ctx2d.beginPath(); ctx2d.arc(0, -45 * s, 16 * s * hs, Math.PI * 0.8, Math.PI * 0.2, true); ctx2d.lineTo(14 * s * hs, -35 * s); ctx2d.lineTo(-14 * s * hs, -35 * s); ctx2d.fill();
  } else if (charDef.helmetType === 'mask') {
    ctx2d.fillStyle = '#333';
    ctx2d.beginPath(); ctx2d.ellipse(0, -43 * s, 10 * s * hs, 8 * s * hs, 0, 0, Math.PI); ctx2d.fill();
  } else if (charDef.helmetType === 'visor') {
    ctx2d.fillStyle = '#555';
    ctx2d.fillRect(-11 * s * hs, -49 * s, 22 * s * hs, 6 * s);
  } else if (charDef.helmetType === 'bandana') {
    ctx2d.fillStyle = charDef.color;
    ctx2d.fillRect(-13 * s * hs, -52 * s, 26 * s * hs, 5 * s);
    ctx2d.beginPath(); ctx2d.moveTo(13 * s * hs, -52 * s); ctx2d.lineTo(22 * s * hs, -46 * s); ctx2d.lineTo(13 * s * hs, -47 * s); ctx2d.fill();
  } else if (charDef.helmetType === 'mohawk') {
    ctx2d.fillStyle = charDef.hair;
    for (let i = 0; i < 6; i++) ctx2d.fillRect((-4 + i * 0) * s * hs, (-60 - i * 2) * s, 4 * s * hs, (8 + i * 2) * s);
    ctx2d.fillRect(-2 * s * hs, -68 * s, 4 * s * hs, 16 * s);
  } else if (charDef.helmetType === 'spikes') {
    ctx2d.fillStyle = '#666';
    for (let i = -2; i <= 2; i++) {
      ctx2d.beginPath(); ctx2d.moveTo((i * 5 - 2) * s * hs, -55 * s); ctx2d.lineTo(i * 5 * s * hs, -66 * s); ctx2d.lineTo((i * 5 + 2) * s * hs, -55 * s); ctx2d.fill();
    }
  } else if (charDef.helmetType === 'halo') {
    ctx2d.strokeStyle = '#fc0'; ctx2d.lineWidth = 2 * s;
    ctx2d.beginPath(); ctx2d.ellipse(0, -60 * s, 14 * s * hs, 4 * s * hs, 0, 0, Math.PI * 2); ctx2d.stroke();
    const haloGlow = ctx2d.createRadialGradient(0, -60 * s, 8 * s, 0, -60 * s, 18 * s);
    haloGlow.addColorStop(0, 'rgba(255,200,0,0.2)'); haloGlow.addColorStop(1, 'transparent');
    ctx2d.fillStyle = haloGlow; ctx2d.beginPath(); ctx2d.arc(0, -60 * s, 18 * s, 0, Math.PI * 2); ctx2d.fill();
  } else if (charDef.helmetType === 'skull') {
    ctx2d.fillStyle = '#ddd';
    ctx2d.beginPath(); ctx2d.arc(0, -45 * s, 13 * s * hs, 0, Math.PI * 2); ctx2d.fill();
    ctx2d.fillStyle = '#111';
    ctx2d.beginPath(); ctx2d.ellipse(-4 * s * hs, -47 * s, 3 * s, 4 * s, 0, 0, Math.PI * 2); ctx2d.fill();
    ctx2d.beginPath(); ctx2d.ellipse(4 * s * hs, -47 * s, 3 * s, 4 * s, 0, 0, Math.PI * 2); ctx2d.fill();
    ctx2d.fillStyle = '#333';
    ctx2d.beginPath(); ctx2d.moveTo(-2 * s, -42 * s); ctx2d.lineTo(2 * s, -42 * s); ctx2d.lineTo(0, -39 * s); ctx2d.fill();
    for (let t = -3; t <= 3; t++) ctx2d.fillRect(t * 2.5 * s * hs - 1, -38 * s, 2, 4 * s);
  } else if (charDef.helmetType === 'flame') {
    for (let i = 0; i < 8; i++) {
      const fx = (Math.random() - 0.5) * 16 * s * hs;
      const fh = 10 + Math.random() * 20;
      const fg = ctx2d.createRadialGradient(fx, -55 * s - fh * 0.5, 1, fx, -55 * s - fh * 0.5, fh * s * 0.5);
      fg.addColorStop(0, 'rgba(255,180,0,0.6)'); fg.addColorStop(0.5, 'rgba(255,80,0,0.3)'); fg.addColorStop(1, 'transparent');
      ctx2d.fillStyle = fg; ctx2d.beginPath(); ctx2d.arc(fx, -55 * s - fh * 0.5, fh * s * 0.5, 0, Math.PI * 2); ctx2d.fill();
    }
  }

  // Eyes
  if (charDef.eyeGlow) {
    const eg = ctx2d.createRadialGradient(-4 * s * hs, -46 * s, 1, -4 * s * hs, -46 * s, 5 * s);
    eg.addColorStop(0, charDef.eyeColor); eg.addColorStop(1, 'transparent');
    ctx2d.fillStyle = eg; ctx2d.beginPath(); ctx2d.arc(-4 * s * hs, -46 * s, 5 * s, 0, Math.PI * 2); ctx2d.fill();
    const eg2 = ctx2d.createRadialGradient(4 * s * hs, -46 * s, 1, 4 * s * hs, -46 * s, 5 * s);
    eg2.addColorStop(0, charDef.eyeColor); eg2.addColorStop(1, 'transparent');
    ctx2d.fillStyle = eg2; ctx2d.beginPath(); ctx2d.arc(4 * s * hs, -46 * s, 5 * s, 0, Math.PI * 2); ctx2d.fill();
  } else {
    ctx2d.fillStyle = '#111';
    ctx2d.fillRect(-6 * s * hs, -48 * s, 3 * s, 3 * s);
    ctx2d.fillRect(3 * s * hs, -48 * s, 3 * s, 3 * s);
  }

  // Scars
  if (charDef.scarCount > 0) {
    ctx2d.strokeStyle = 'rgba(150,50,50,0.5)'; ctx2d.lineWidth = 1.5 * s;
    if (charDef.scarCount >= 1) { ctx2d.beginPath(); ctx2d.moveTo(3 * s, -50 * s); ctx2d.lineTo(8 * s, -40 * s); ctx2d.stroke(); }
    if (charDef.scarCount >= 2) { ctx2d.beginPath(); ctx2d.moveTo(-6 * s, -48 * s); ctx2d.lineTo(-2 * s, -38 * s); ctx2d.stroke(); }
    if (charDef.scarCount >= 3) { ctx2d.beginPath(); ctx2d.moveTo(-3 * s, -44 * s); ctx2d.lineTo(5 * s, -44 * s); ctx2d.stroke(); }
  }

  // Selection indicator
  if (selected) {
    ctx2d.strokeStyle = '#fff'; ctx2d.lineWidth = 2;
    ctx2d.setLineDash([4, 4]);
    ctx2d.beginPath(); ctx2d.arc(0, -10 * s, 45 * s, 0, Math.PI * 2); ctx2d.stroke();
    ctx2d.setLineDash([]);
  }

  ctx2d.restore();
};

const initCampaign = (charId: string): CampaignState => ({
  level: 1, playerCharId: charId, totalScore: 0,
  levelScores: [], totalDamageDealt: 0, totalCombos: 0,
  bestCombo: 0, totalTime: 0, levelsComplete: Array(12).fill(false),
});

const RagdollArena = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameScreen, setGameScreen] = useState<GameScreen>('menu');
  const [sfxVolume, setSfxVolume] = useState(0.15);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [selectedP1, setSelectedP1] = useState<string>('siegfried');
  const [selectedP2, setSelectedP2] = useState<string>('nightmare');
  const [selectingFor, setSelectingFor] = useState<1 | 2>(1);
  const [campaign, setCampaign] = useState<CampaignState>(initCampaign('siegfried'));
  const [campaignChar, setCampaignChar] = useState<string>('siegfried');
  const campaignRef = useRef<CampaignState>(initCampaign('siegfried'));
  // Extended settings
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('general');
  const [moveSpeed, setMoveSpeed] = useState(1.4);
  const [gamepadDeadzone, setGamepadDeadzone] = useState(0.15);
  const [screenShake, setScreenShake] = useState(true);
  const [bloodAmount, setBloodAmount] = useState(1.0);
  const [slowMoIntensity, setSlowMoIntensity] = useState(1.0);
  const [autoFaceEnemy, setAutoFaceEnemy] = useState(true);
  const [showDamageNumbers, setShowDamageNumbers] = useState(true);
  const [showComboCounter, setShowComboCounter] = useState(true);
  const [musicVolume, setMusicVolume] = useState(0.3);
  const [cameraZoom, setCameraZoom] = useState(1.0);
  const [menuIndex, setMenuIndex] = useState(0);
  const [gamepadConnected, setGamepadConnected] = useState(false);

  // Gamepad connection detection
  useEffect(() => {
    const onConnect = () => setGamepadConnected(true);
    const onDisconnect = () => setGamepadConnected(false);
    window.addEventListener('gamepadconnected', onConnect);
    window.addEventListener('gamepaddisconnected', onDisconnect);
    // Check initial
    if (navigator.getGamepads?.()[0]) setGamepadConnected(true);
    return () => { window.removeEventListener('gamepadconnected', onConnect); window.removeEventListener('gamepaddisconnected', onDisconnect); };
  }, []);

  // Gamepad menu navigation
  useEffect(() => {
    if (gameScreen === 'fight' || gameScreen === 'campaignFight') return;
    let rafId: number;
    const poll = () => {
      const gp = readGamepad(gamepadDeadzone);
      const justUp = gp.up && !gpMenuPrev.up;
      const justDown = gp.down && !gpMenuPrev.down;
      const justLeft = gp.left && !gpMenuPrev.left;
      const justRight = gp.right && !gpMenuPrev.right;
      const justConfirm = gp.confirm && !gpMenuPrev.confirm;
      const justBack = gp.back && !gpMenuPrev.back;
      const justStart = gp.start && !gpMenuPrev.start;
      gpMenuPrev = { up: gp.up, down: gp.down, left: gp.left, right: gp.right, confirm: gp.confirm, back: gp.back, start: gp.start };

      if (gameScreen === 'menu') {
        if (justUp) setMenuIndex(i => Math.max(0, i - 1));
        if (justDown) setMenuIndex(i => Math.min(2, i + 1));
        if (justConfirm) {
          if (menuIndex === 0) setGameScreen('campaignSelect');
          else if (menuIndex === 1) setGameScreen('charSelect');
          else if (menuIndex === 2) setGameScreen('settings');
        }
      } else if (gameScreen === 'campaignSelect') {
        const charIds = CHARACTERS.map(c => c.id);
        const curIdx = charIds.indexOf(campaignChar);
        if (justLeft) setCampaignChar(charIds[Math.max(0, curIdx - 1)]);
        if (justRight) setCampaignChar(charIds[Math.min(charIds.length - 1, curIdx + 1)]);
        if (justUp) setCampaignChar(charIds[Math.max(0, curIdx - 4)]);
        if (justDown) setCampaignChar(charIds[Math.min(charIds.length - 1, curIdx + 4)]);
        if (justConfirm) { const cs = initCampaign(campaignChar); setCampaign(cs); campaignRef.current = cs; setGameScreen('cinematic'); }
        if (justBack) setGameScreen('menu');
      } else if (gameScreen === 'charSelect') {
        const charIds = CHARACTERS.map(c => c.id);
        const isP1 = selectingFor === 1;
        const curSel = isP1 ? selectedP1 : selectedP2;
        const curIdx = charIds.indexOf(curSel);
        if (justLeft) { const ni = Math.max(0, curIdx - 1); if (isP1) setSelectedP1(charIds[ni]); else setSelectedP2(charIds[ni]); }
        if (justRight) { const ni = Math.min(charIds.length - 1, curIdx + 1); if (isP1) setSelectedP1(charIds[ni]); else setSelectedP2(charIds[ni]); }
        if (justUp) { const ni = Math.max(0, curIdx - 6); if (isP1) setSelectedP1(charIds[ni]); else setSelectedP2(charIds[ni]); }
        if (justDown) { const ni = Math.min(charIds.length - 1, curIdx + 6); if (isP1) setSelectedP1(charIds[ni]); else setSelectedP2(charIds[ni]); }
        if (justConfirm) { if (isP1) { setSelectingFor(2); } else { setGameScreen('fight'); } }
        if (justBack) { if (!isP1) { setSelectingFor(1); } else { setGameScreen('menu'); } }
      } else if (gameScreen === 'cinematic') {
        if (justConfirm || justStart) setGameScreen('campaignFight');
        if (justBack) setGameScreen('campaignSelect');
      } else if (gameScreen === 'victory') {
        if (justConfirm) setGameScreen('menu');
      } else if (gameScreen === 'settings') {
        if (justBack) setGameScreen('menu');
      }
      rafId = requestAnimationFrame(poll);
    };
    rafId = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(rafId);
  }, [gameScreen, menuIndex, campaignChar, selectedP1, selectedP2, selectingFor, gamepadDeadzone]);

  const G = useRef({
    fighters: [
      mkFighterFromChar(2800, CHARACTERS[0], true),
      mkFighterFromChar(3200, CHARACTERS[1], true),
    ],
    blood: [] as Blood[], sparks: [] as Spark[], pools: [] as Pool[],
    limbs: [] as SevLimb[], gore: [] as GoreChunk[], afterimages: [] as Afterimage[],
    rings: [] as ImpactRing[], lightnings: [] as Lightning[],
    bullets: [] as Bullet[], muzzleFlashes: [] as MuzzleFlash[], wallSparks: [] as WallSpark[],
    fatalityTexts: [] as FatalityText[], thrownSwords: [] as ThrownSword[],
    specials: [] as SpecialEntity[],
    slowMo: 1, slowTimer: 0, flash: 0, flashColor: '#fff',
    round: 1, timer: 99 * 60,
    rs: 'intro' as 'intro' | 'fight' | 'ko',
    introTimer: 100, koTimer: 0, keys: new Set<string>(), bgTime: 0,
    camX: 2360,
    clouds: Array.from({ length: 12 }, () => ({ x: rng(0, WORLD_W), y: rng(20, 200), w: rng(60, 200), speed: rng(0.1, 0.5), opacity: rng(0.02, 0.08) })),
    torches: [] as { x: number; y: number }[],
    scenery: (() => {
      const items: { type: string; x: number; scale: number; flip: boolean }[] = [];
      for (let i = 0; i < 25; i++) items.push({ type: 'deadTree', x: rng(100, WORLD_W - 100), scale: 0.7 + rng(0, 0.6), flip: Math.random() > 0.5 });
      for (let i = 0; i < 30; i++) items.push({ type: 'grave', x: rng(100, WORLD_W - 100), scale: 0.6 + rng(0, 0.5), flip: Math.random() > 0.5 });
      for (let i = 0; i < 12; i++) items.push({ type: 'pillar', x: rng(200, WORLD_W - 200), scale: 0.8 + rng(0, 0.4), flip: Math.random() > 0.5 });
      for (let i = 0; i < 15; i++) items.push({ type: 'stone', x: rng(100, WORLD_W - 100), scale: 0.5 + rng(0, 0.7), flip: false });
      for (let i = 0; i < 18; i++) items.push({ type: 'fence', x: rng(100, WORLD_W - 100), scale: 0.8 + rng(0, 0.3), flip: false });
      for (let i = 0; i < 10; i++) items.push({ type: 'skull', x: rng(200, WORLD_W - 200), scale: 0.7 + rng(0, 0.4), flip: Math.random() > 0.5 });
      for (let i = 0; i < 4; i++) items.push({ type: 'castle', x: 800 + i * 1400, scale: 0.8 + rng(0, 0.4), flip: false });
      items.sort((a, b) => a.x - b.x);
      return items;
    })(),
    farMountains: Array.from({ length: 120 }, (_, i) => ({
      x: i * (WORLD_W / 40),
      h: 80 + Math.sin(i * 0.25) * 50 + Math.sin(i * 0.08) * 30 + rng(0, 20),
    })),
    nearMountains: Array.from({ length: 80 }, (_, i) => ({
      x: i * (WORLD_W / 30),
      h: 50 + Math.sin(i * 0.35 + 1) * 35 + rng(0, 15),
    })),
  });
  const [hud, setHud] = useState({
    p1hp: MAX_HP, p2hp: MAX_HP, timer: 99, round: 1,
    p1st: 100, p2st: 100, p1w: 0, p2w: 0,
    rs: 'intro', n1: 'SIEGFRIED', n2: 'NIGHTMARE',
    w1: 'Greatsword', w2: 'Battle Axe',
    p1limb: false, p2limb: false,
  });

  const spawnBlood = useCallback((x: number, y: number, dir: number, count: number, power: number) => {
    const g = G.current;
    for (let i = 0; i < count; i++) {
      g.blood.push({ x: x + rng(-8, 8), y: y - rng(0, 10), vx: dir * (2 + rng(0, power * 7)) + rng(-1, 1) * power * 4, vy: -(2 + rng(0, power * 8)) + rng(0, 3), life: 140 + rng(0, 180), maxLife: 320, sz: 1.5 + rng(0, 4.5) * power, grounded: false });
    }
  }, []);
  const spawnGore = useCallback((x: number, y: number, count: number, dir: number) => {
    const g = G.current;
    for (let i = 0; i < count; i++) {
      g.gore.push({ x, y, vx: dir * rng(2, 10) + rng(-3, 3), vy: -rng(4, 14), sz: rng(2, 8), life: 200 + rng(0, 200), rot: rng(0, 6.28), rotV: rng(-0.3, 0.3), color: pick(['#600', '#800', '#500', '#711', '#400', '#900', '#520']) });
    }
  }, []);
  const spawnSparks = useCallback((x: number, y: number, count: number) => {
    const g = G.current;
    for (let i = 0; i < count; i++) {
      g.sparks.push({ x, y, vx: rng(-8, 8) * 2, vy: -(2 + rng(0, 12)), life: 8 + rng(0, 14), color: pick(['#ffa', '#ff8', '#ffd', '#fa0', '#f80']), sz: 1 + rng(0, 3) });
    }
  }, []);
  const spawnRing = useCallback((x: number, y: number, maxR: number, color: string) => { G.current.rings.push({ x, y, r: 5, maxR, life: 1, color }); }, []);
  const spawnLightning = useCallback((x1: number, y1: number, x2: number, y2: number) => {
    const branches: V[][] = [];
    for (let b = 0; b < 3; b++) { const pts: V[] = [v(x1, y1)]; const steps = 5 + Math.floor(rng(0, 5)); for (let i = 1; i <= steps; i++) { const t = i / steps; pts.push(v(x1 + (x2 - x1) * t + rng(-30, 30), y1 + (y2 - y1) * t + rng(-20, 20))); } branches.push(pts); }
    G.current.lightnings.push({ x1, y1, x2, y2, life: 8, branches });
  }, []);
  const spawnAfterimage = useCallback((f: Fighter) => { G.current.afterimages.push({ x: f.x, y: f.y, pts: f.rag.pts.map(p => ({ ...p.pos })), alpha: 0.4, color: f.color }); }, []);
  const spawnBullet = useCallback((f: Fighter, idx: number) => {
    const g = G.current; const hand = f.rag.pts[7].pos;
    const ang = Math.atan2(g.fighters[1 - idx].y - 60 - hand.y, g.fighters[1 - idx].x - hand.x) + rng(-0.1, 0.1);
    g.bullets.push({ x: hand.x, y: hand.y, vx: Math.cos(ang) * 22, vy: Math.sin(ang) * 22, life: 40, owner: idx, dmg: 8 + rng(0, 5), trail: [{ x: hand.x, y: hand.y }] });
    g.muzzleFlashes.push({ x: hand.x + Math.cos(ang) * 15, y: hand.y + Math.sin(ang) * 15, ang, life: 4 });
    for (let i = 0; i < 6; i++) g.sparks.push({ x: hand.x, y: hand.y, vx: Math.cos(ang + rng(-0.5, 0.5)) * rng(3, 10), vy: Math.sin(ang + rng(-0.5, 0.5)) * rng(3, 10), life: 5 + rng(0, 8), color: pick(['#ff8', '#ffa', '#fa0']), sz: 1 + rng(0, 2) });
    f.muzzleFlash = 4;
    playSFX('gunshot', sfxVolume);
  }, [sfxVolume]);
  const spawnWallSparks = useCallback((x: number, y: number, count: number, dir: number) => {
    const g = G.current;
    for (let i = 0; i < count; i++) g.wallSparks.push({ x, y: y + rng(-10, 10), vx: dir * rng(2, 8), vy: rng(-4, 2), life: 8 + rng(0, 10) });
  }, []);

  const sever = useCallback((f: Fighter, part: string, dir: number) => {
    if (f.severed.has(part)) return;
    f.severed.add(part);
    const g = G.current;
    const pts: V[] = [];
    const indices = part === 'leftArm' ? [5, 6, 7] : part === 'rightArm' ? [8, 9, 10] : part === 'leftLeg' ? [11, 12, 13] : part === 'rightLeg' ? [14, 15, 16] : [0];
    indices.forEach(i => { if (f.rag.pts[i]) pts.push({ ...f.rag.pts[i].pos }); });
    g.limbs.push({ pts, vel: v(dir * (6 + rng(0, 14)), -(10 + rng(0, 14))), angV: rng(-0.6, 0.6), ang: 0, color: part === 'head' ? f.skin : f.color, w: part.includes('Leg') ? 7 : part === 'head' ? 14 : 5, life: 1200, isHead: part === 'head', grounded: false, id: limbIdCounter++ });
    spawnBlood(f.x, f.y - 60, dir, 90, 5); spawnBlood(f.x, f.y - 70, -dir * 0.5, 45, 4.5); spawnBlood(f.x, f.y - 65, 0, 35, 4);
    spawnGore(f.x, f.y - 55, 12, dir); spawnRing(f.x, f.y - 50, 80, '#a00');
    f.bleedTimer = 600; g.slowMo = 0.1; g.slowTimer = 40; g.flash = 8; g.flashColor = '#600';
    playSFX('sever', sfxVolume);
    // TTS: victim reacts to losing a limb
    if (ttsEnabled) {
      const fIdx = g.fighters.indexOf(f);
      if (part === 'head') {
        speakFighterLine(HEAD_LOST_LINES, fIdx >= 0 ? fIdx : 0);
      } else {
        speakFighterLine(LIMB_LOST_LINES, fIdx >= 0 ? fIdx : 0);
      }
    }
  }, [spawnBlood, spawnGore, spawnRing, sfxVolume, ttsEnabled]);

  // ─── DRAW FIGHTER ──────────────────────────────────────
  const drawFighter = useCallback((ctx: CanvasRenderingContext2D, f: Fighter, t: number) => {
    const p = f.rag.pts;
    const charDef = getCharacter(f.charId);
    const drawBone = (a: number, b: number, w: number, col: string) => {
      if (f.severed.has('leftArm') && [5, 6, 7].includes(a) && [5, 6, 7].includes(b)) return;
      if (f.severed.has('rightArm') && [8, 9, 10].includes(a) && [8, 9, 10].includes(b)) return;
      if (f.severed.has('leftLeg') && [11, 12, 13].includes(a) && [11, 12, 13].includes(b)) return;
      if (f.severed.has('rightLeg') && [14, 15, 16].includes(a) && [14, 15, 16].includes(b)) return;
      ctx.strokeStyle = col; ctx.lineWidth = w * (charDef.bodyScale ?? 1); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(p[a].pos.x, p[a].pos.y); ctx.lineTo(p[b].pos.x, p[b].pos.y); ctx.stroke();
    };

    // Aura glow
    if (charDef.glowColor) {
      const glow = ctx.createRadialGradient(f.x, f.y - 50, 5, f.x, f.y - 50, 60);
      glow.addColorStop(0, charDef.glowColor + '18'); glow.addColorStop(0.6, charDef.glowColor + '08'); glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(f.x, f.y - 50, 60, 0, Math.PI * 2); ctx.fill();
    }

    // Cape
    if (charDef.capeColor && !f.ragdolling) {
      const spine = p[2].pos; const hip = p[4].pos;
      const windOff = Math.sin(t * 0.03 + f.bob) * 8;
      ctx.fillStyle = charDef.capeColor + 'cc';
      ctx.beginPath();
      ctx.moveTo(spine.x - 5 * f.facing, spine.y);
      ctx.quadraticCurveTo(hip.x - 20 * f.facing + windOff, hip.y + 15, hip.x - 15 * f.facing + windOff * 1.5, hip.y + 40);
      ctx.lineTo(hip.x - 5 * f.facing, hip.y);
      ctx.fill();
    }

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(p[4].pos.x, GY + 2, 30 * (charDef.bodyScale ?? 1), 7, 0, 0, Math.PI * 2); ctx.fill();

    // Wall run dust
    if (f.state === 'wallRun') {
      const wallX = f.wallSide < 0 ? WALL_L : WALL_R;
      for (let i = 0; i < 3; i++) { ctx.fillStyle = `rgba(150,130,100,${0.15 + rng(0, 0.1)})`; ctx.beginPath(); ctx.arc(wallX + f.wallSide * rng(-5, 15), f.y + rng(-20, 10), rng(2, 6), 0, Math.PI * 2); ctx.fill(); }
    }

    // Legs (longer proportions)
    drawBone(4, 11, 9, f.color); drawBone(11, 12, 8, f.color); drawBone(12, 13, 7, f.color);
    drawBone(4, 14, 9, f.color); drawBone(14, 15, 8, f.color); drawBone(15, 16, 7, f.color);
    // Knee caps
    if (!f.severed.has('leftLeg')) {
      ctx.fillStyle = f.color; ctx.beginPath(); ctx.arc(p[12].pos.x, p[12].pos.y, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.beginPath(); ctx.arc(p[12].pos.x - 1, p[12].pos.y - 1, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#333'; ctx.beginPath(); ctx.ellipse(p[13].pos.x + 4, Math.min(p[13].pos.y, GY), 9, 5, 0, 0, Math.PI * 2); ctx.fill();
    }
    if (!f.severed.has('rightLeg')) {
      ctx.fillStyle = f.color; ctx.beginPath(); ctx.arc(p[15].pos.x, p[15].pos.y, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.beginPath(); ctx.arc(p[15].pos.x - 1, p[15].pos.y - 1, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#333'; ctx.beginPath(); ctx.ellipse(p[16].pos.x + 4, Math.min(p[16].pos.y, GY), 9, 5, 0, 0, Math.PI * 2); ctx.fill();
    }

    // Torso (with visible spine bend)
    drawBone(1, 2, 12, f.color); drawBone(2, 3, 11, f.color); drawBone(3, 4, 10, f.color);
    const chestMid = vlerp(p[2].pos, p[3].pos, 0.5);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(p[2].pos.x - 6, p[2].pos.y); ctx.lineTo(p[4].pos.x + 6, p[4].pos.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(chestMid.x - 8, chestMid.y); ctx.lineTo(chestMid.x + 8, chestMid.y); ctx.stroke();

    // Shoulders & Arms
    drawBone(1, 5, 7, f.color); drawBone(1, 8, 7, f.color);
    drawBone(5, 6, 6, f.skin); drawBone(6, 7, 5, f.skin);
    drawBone(8, 9, 6, f.skin); drawBone(9, 10, 5, f.skin);
    if (!f.severed.has('leftArm')) { ctx.fillStyle = f.color; ctx.beginPath(); ctx.arc(p[7].pos.x, p[7].pos.y, 4, 0, Math.PI * 2); ctx.fill(); }
    if (!f.severed.has('rightArm')) { ctx.fillStyle = f.color; ctx.beginPath(); ctx.arc(p[10].pos.x, p[10].pos.y, 4, 0, Math.PI * 2); ctx.fill(); }

    // Sever stumps
    ['leftArm', 'rightArm', 'leftLeg', 'rightLeg', 'head'].forEach(part => {
      if (!f.severed.has(part)) return;
      const idx2 = part === 'leftArm' ? 5 : part === 'rightArm' ? 8 : part === 'leftLeg' ? 11 : part === 'rightLeg' ? 14 : 1;
      ctx.fillStyle = '#900'; ctx.beginPath(); ctx.arc(p[idx2].pos.x, p[idx2].pos.y, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#600'; ctx.beginPath(); ctx.arc(p[idx2].pos.x, p[idx2].pos.y, 4, 0, Math.PI * 2); ctx.fill();
      if (f.bleedTimer > 0) {
        for (let ss2 = 0; ss2 < 6; ss2++) { ctx.fillStyle = `rgba(220,0,0,${0.4 + rng(0, 0.5)})`; ctx.beginPath(); ctx.arc(p[idx2].pos.x + rng(-8, 8), p[idx2].pos.y - rng(0, 18), 1.5 + rng(0, 3.5), 0, Math.PI * 2); ctx.fill(); }
        ctx.strokeStyle = `rgba(200,0,0,${Math.min(1, f.bleedTimer / 250)})`; ctx.lineWidth = 2.5 + rng(0, 2);
        ctx.beginPath(); ctx.moveTo(p[idx2].pos.x, p[idx2].pos.y); ctx.quadraticCurveTo(p[idx2].pos.x + rng(-25, 25), p[idx2].pos.y + 10 + rng(0, 20), p[idx2].pos.x + rng(-35, 35), p[idx2].pos.y + 20 + rng(0, 25)); ctx.stroke();
      }
    });

    // ── SHIELD ──
    if (!f.severed.has('leftArm') && f.shieldHP > 0) {
      const lhand = p[7].pos;
      const lshoulder = p[5].pos;
      const shieldAng = Math.atan2(lhand.y - lshoulder.y, lhand.x - lshoulder.x) + Math.PI * 0.5;
      const shieldAlpha = f.state === 'block' ? 1 : 0.7;
      const shieldSize = f.state === 'block' ? 1.2 : 0.9;
      ctx.save(); ctx.translate(lhand.x, lhand.y); ctx.rotate(shieldAng);
      ctx.fillStyle = `rgba(80,70,50,${shieldAlpha})`; ctx.beginPath();
      ctx.ellipse(0, 0, 12 * shieldSize, 18 * shieldSize, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = `rgba(160,140,80,${shieldAlpha})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, 0, 12 * shieldSize, 18 * shieldSize, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = `rgba(200,180,100,${shieldAlpha * 0.6})`; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, -8 * shieldSize); ctx.lineTo(0, 8 * shieldSize); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-6 * shieldSize, 0); ctx.lineTo(6 * shieldSize, 0); ctx.stroke();
      if (f.shieldHP < 30) {
        ctx.strokeStyle = `rgba(100,80,40,${shieldAlpha})`; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-4, -8); ctx.lineTo(3, 5); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(5, -5); ctx.lineTo(-2, 8); ctx.stroke();
      }
      if (f.state === 'block') {
        const sg = ctx.createRadialGradient(0, 0, 5, 0, 0, 25);
        sg.addColorStop(0, 'rgba(200,180,100,0.15)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(0, 0, 25, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    // ── PISTOL ──
    if (!f.severed.has('leftArm') && f.state === 'shoot') {
      const lhand = p[7].pos;
      const gRef = G.current;
      const oIdx = f === gRef.fighters[0] ? 1 : 0;
      const other = gRef.fighters[oIdx];
      const gunAng = Math.atan2(other.y - 60 - lhand.y, other.x - lhand.x);
      ctx.save(); ctx.translate(lhand.x, lhand.y); ctx.rotate(gunAng);
      ctx.fillStyle = '#444'; ctx.fillRect(0, -3, 18, 6);
      ctx.fillStyle = '#666'; ctx.fillRect(14, -2, 8, 4);
      ctx.fillStyle = '#332'; ctx.fillRect(2, 3, 6, 8);
      if (f.muzzleFlash > 0) {
        const mfSize = f.muzzleFlash * 4;
        const mfGrad = ctx.createRadialGradient(22, 0, 1, 22, 0, mfSize);
        mfGrad.addColorStop(0, 'rgba(255,255,200,0.9)'); mfGrad.addColorStop(0.3, 'rgba(255,180,50,0.6)'); mfGrad.addColorStop(1, 'rgba(255,100,0,0)');
        ctx.fillStyle = mfGrad; ctx.beginPath(); ctx.arc(22, 0, mfSize, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    // ── WEAPON ──
    if (!f.severed.has('rightArm') && f.hasSword) {
      const hand = p[10].pos; const ang = f.wAngle * f.facing; const wl = f.weapon.len;
      const tipX = hand.x + Math.cos(ang) * wl, tipY = hand.y + Math.sin(ang) * wl;
      const isAtk = ['slash', 'heavySlash', 'overhead', 'stab', 'jumpAtk', 'uppercut', 'spinSlash', 'dashStab', 'limbSmash', 'backflipKick', 'execution', 'wallFlip', 'divekick', 'fatality'].includes(f.state);
      const ap2 = f.dur > 0 ? f.frame / f.dur : 0;
      if (isAtk && ap2 > 0.2 && ap2 < 0.7) {
        ctx.strokeStyle = `rgba(255,255,255,${0.2 * (1 - Math.abs(ap2 - 0.45) * 4)})`; ctx.lineWidth = 18;
        ctx.beginPath(); ctx.moveTo(hand.x, hand.y); ctx.lineTo(tipX, tipY); ctx.stroke();
      }
      ctx.strokeStyle = f.weapon.blade; ctx.lineWidth = f.weapon.type === 'greatsword' ? 5 : f.weapon.type === 'axe' ? 4 : 3;
      ctx.beginPath(); ctx.moveTo(hand.x, hand.y); ctx.lineTo(tipX, tipY); ctx.stroke();
      ctx.strokeStyle = f.weapon.color; ctx.lineWidth = 3;
      const hx = hand.x - Math.cos(ang) * 14, hy = hand.y - Math.sin(ang) * 14;
      ctx.beginPath(); ctx.moveTo(hand.x, hand.y); ctx.lineTo(hx, hy); ctx.stroke();
      ctx.strokeStyle = '#aa9'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(hand.x + Math.sin(ang) * 6, hand.y - Math.cos(ang) * 6); ctx.lineTo(hand.x - Math.sin(ang) * 6, hand.y + Math.cos(ang) * 6); ctx.stroke();
      if (f.weapon.type === 'axe') {
        const ax = tipX - Math.cos(ang) * 8, ay = tipY - Math.sin(ang) * 8;
        ctx.fillStyle = '#999'; ctx.beginPath(); ctx.moveTo(ax + Math.sin(ang) * 12, ay - Math.cos(ang) * 12); ctx.lineTo(tipX, tipY); ctx.lineTo(ax - Math.sin(ang) * 12, ay + Math.cos(ang) * 12); ctx.closePath(); ctx.fill();
      }
      if (f.weapon.type === 'spear') {
        ctx.fillStyle = '#ccd'; ctx.beginPath(); ctx.moveTo(tipX, tipY); ctx.lineTo(tipX - Math.cos(ang) * 14 + Math.sin(ang) * 5, tipY - Math.sin(ang) * 14 - Math.cos(ang) * 5); ctx.lineTo(tipX - Math.cos(ang) * 14 - Math.sin(ang) * 5, tipY - Math.sin(ang) * 14 + Math.cos(ang) * 5); ctx.closePath(); ctx.fill();
      }
    }

    // ── HELD LIMB ──
    if (f.heldLimb && !f.severed.has('leftArm')) {
      const lhand = p[7].pos;
      ctx.save(); ctx.translate(lhand.x, lhand.y); ctx.rotate(f.limbSwingAng * f.facing);
      if (f.heldLimb.isHead) {
        ctx.fillStyle = f.heldLimb.color; ctx.beginPath(); ctx.arc(0, -15, 13, 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = '#111'; ctx.beginPath(); ctx.moveTo(-5, -17); ctx.lineTo(-2, -14); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(5, -17); ctx.lineTo(2, -14); ctx.stroke();
        ctx.fillStyle = '#800'; ctx.beginPath(); ctx.arc(0, -2, 5, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.strokeStyle = f.heldLimb.color; ctx.lineWidth = f.heldLimb.w; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -35); ctx.stroke();
        ctx.fillStyle = '#800'; ctx.beginPath(); ctx.arc(0, -35, 4, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    // ── ARMOR DETAILS on torso ──
    if (charDef.armorType === 'heavy') {
      const chestTop = p[2].pos; const chestBot = p[3].pos;
      ctx.strokeStyle = charDef.color2; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(chestTop.x - 8, chestTop.y); ctx.lineTo(chestTop.x + 8, chestTop.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(chestBot.x - 6, chestBot.y); ctx.lineTo(chestBot.x + 6, chestBot.y); ctx.stroke();
    } else if (charDef.armorType === 'robe' && !f.ragdolling) {
      const hip = p[4].pos;
      ctx.fillStyle = f.color + 'aa';
      ctx.beginPath();
      ctx.moveTo(hip.x - 12, hip.y - 5); ctx.lineTo(hip.x - 15, hip.y + 30);
      ctx.lineTo(hip.x + 15, hip.y + 30); ctx.lineTo(hip.x + 12, hip.y - 5);
      ctx.fill();
    }

    // ── TATTOOS on body ──
    if (charDef.tattooColor) {
      const spine = p[3].pos;
      ctx.strokeStyle = charDef.tattooColor + '60'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(spine.x, spine.y, 6, 0, Math.PI); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(spine.x - 4, spine.y + 3); ctx.lineTo(spine.x - 8, spine.y + 10); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(spine.x + 4, spine.y + 3); ctx.lineTo(spine.x + 8, spine.y + 10); ctx.stroke();
    }

    // ── HEAD ──
    if (!f.severed.has('head')) {
      const hPos = p[0].pos, nPos = p[1].pos;
      const headAng = Math.atan2(hPos.x - nPos.x, -(hPos.y - nPos.y));
      const hs = charDef.headScale ?? 1;
      ctx.save(); ctx.translate(hPos.x, hPos.y); ctx.rotate(headAng);
      ctx.fillStyle = f.hair; ctx.beginPath(); ctx.arc(0, 0, 15 * hs, Math.PI * 1.1, -0.1 * Math.PI); ctx.fill();
      ctx.fillStyle = f.skin; ctx.beginPath(); ctx.arc(0, 0, 13 * hs, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = f.color; ctx.fillRect(-14 * hs, -8, 28 * hs, 5);

      // Helmet
      if (charDef.helmetType === 'crown') {
        ctx.fillStyle = '#daa520';
        ctx.fillRect(-10 * hs, -16 * hs, 20 * hs, 4);
        for (let i = -2; i <= 2; i++) ctx.fillRect(i * 4 * hs - 1, -20 * hs, 3, 4);
      } else if (charDef.helmetType === 'horns') {
        ctx.strokeStyle = '#888'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(-10 * hs, -8); ctx.quadraticCurveTo(-18 * hs, -28, -12 * hs, -30); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(10 * hs, -8); ctx.quadraticCurveTo(18 * hs, -28, 12 * hs, -30); ctx.stroke();
      } else if (charDef.helmetType === 'hood') {
        ctx.fillStyle = f.color;
        ctx.beginPath(); ctx.arc(0, 0, 17 * hs, Math.PI * 0.75, Math.PI * 0.25, true); ctx.lineTo(14 * hs, 5); ctx.lineTo(-14 * hs, 5); ctx.fill();
      } else if (charDef.helmetType === 'mask') {
        ctx.fillStyle = '#333';
        ctx.beginPath(); ctx.ellipse(0, 2, 11 * hs, 8 * hs, 0, 0, Math.PI); ctx.fill();
      } else if (charDef.helmetType === 'bandana') {
        ctx.fillStyle = f.color;
        ctx.fillRect(-14 * hs, -10, 28 * hs, 5);
        ctx.beginPath(); ctx.moveTo(14 * hs, -10); ctx.lineTo(22 * hs, -4); ctx.lineTo(14 * hs, -5); ctx.fill();
      } else if (charDef.helmetType === 'mohawk') {
        ctx.fillStyle = charDef.hair;
        ctx.fillRect(-2 * hs, -26 * hs, 4 * hs, 16 * hs);
      } else if (charDef.helmetType === 'spikes') {
        ctx.fillStyle = '#666';
        for (let i = -2; i <= 2; i++) {
          ctx.beginPath(); ctx.moveTo(i * 5 * hs - 2, -12); ctx.lineTo(i * 5 * hs, -24); ctx.lineTo(i * 5 * hs + 2, -12); ctx.fill();
        }
      } else if (charDef.helmetType === 'halo') {
        ctx.strokeStyle = '#fc0'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(0, -18 * hs, 14 * hs, 4, 0, 0, Math.PI * 2); ctx.stroke();
      } else if (charDef.helmetType === 'skull') {
        ctx.fillStyle = '#ddd';
        ctx.beginPath(); ctx.arc(0, 0, 13 * hs, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.ellipse(-4 * hs, -2, 3, 4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(4 * hs, -2, 3, 4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#333';
        for (let tt = -3; tt <= 3; tt++) ctx.fillRect(tt * 2.5 * hs - 1, 6, 2, 4);
      } else if (charDef.helmetType === 'flame') {
        for (let i = 0; i < 5; i++) {
          const fx = (Math.random() - 0.5) * 16 * hs;
          const fh = 8 + Math.random() * 14;
          const fg = ctx.createRadialGradient(fx, -12 - fh * 0.5, 1, fx, -12 - fh * 0.5, fh * 0.5);
          fg.addColorStop(0, 'rgba(255,180,0,0.5)'); fg.addColorStop(0.5, 'rgba(255,80,0,0.2)'); fg.addColorStop(1, 'transparent');
          ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(fx, -12 - fh * 0.5, fh * 0.5, 0, Math.PI * 2); ctx.fill();
        }
      }

      // Scars
      if (charDef.scarCount > 0) {
        ctx.strokeStyle = 'rgba(150,50,50,0.5)'; ctx.lineWidth = 1.5;
        if (charDef.scarCount >= 1) { ctx.beginPath(); ctx.moveTo(3, -6); ctx.lineTo(8, 4); ctx.stroke(); }
        if (charDef.scarCount >= 2) { ctx.beginPath(); ctx.moveTo(-6, -4); ctx.lineTo(-2, 6); ctx.stroke(); }
        if (charDef.scarCount >= 3) { ctx.beginPath(); ctx.moveTo(-3, 0); ctx.lineTo(5, 0); ctx.stroke(); }
      }

      if (f.headHits > 0) {
        const bruise = Math.min(f.headHits / 8, 1);
        ctx.fillStyle = `rgba(100,0,100,${bruise * 0.4})`; ctx.beginPath(); ctx.arc(3, -2, 6, 0, Math.PI * 2); ctx.fill();
        if (f.headHits > 3) { ctx.fillStyle = `rgba(80,0,0,${bruise * 0.3})`; ctx.beginPath(); ctx.arc(-5, 3, 5, 0, Math.PI * 2); ctx.fill(); }
      }
      if (f.state === 'ko' || f.state === 'ragdoll') {
        ctx.lineWidth = 2; ctx.strokeStyle = '#111';
        [-5, 5].forEach(ex => { ctx.beginPath(); ctx.moveTo(ex - 3, -2); ctx.lineTo(ex + 3, 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(ex + 3, -2); ctx.lineTo(ex - 3, 2); ctx.stroke(); });
      } else if (f.state === 'taunt') {
        ctx.fillStyle = '#111'; ctx.fillRect(-7, -4, 3, 4); ctx.fillRect(4, -4, 3, 4);
        ctx.strokeStyle = '#444'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 6, 5, 0, Math.PI); ctx.stroke();
      } else {
        // Eyes with optional glow
        if (charDef.eyeGlow) {
          const eg1 = ctx.createRadialGradient(-5, -2, 1, -5, -2, 5);
          eg1.addColorStop(0, charDef.eyeColor); eg1.addColorStop(1, 'transparent');
          ctx.fillStyle = eg1; ctx.beginPath(); ctx.arc(-5, -2, 5, 0, Math.PI * 2); ctx.fill();
          const eg2 = ctx.createRadialGradient(5, -2, 1, 5, -2, 5);
          eg2.addColorStop(0, charDef.eyeColor); eg2.addColorStop(1, 'transparent');
          ctx.fillStyle = eg2; ctx.beginPath(); ctx.arc(5, -2, 5, 0, Math.PI * 2); ctx.fill();
        } else {
          const ed = f.facing > 0 ? 1 : -1;
          ctx.fillStyle = '#111'; ctx.fillRect(-7 * ed - 1, -4, 3, 4); ctx.fillRect(3 * ed, -4, 3, 4);
          ctx.fillStyle = charDef.eyeColor; ctx.fillRect(-7 * ed, -3, 1.5, 1.5); ctx.fillRect(3 * ed + 1, -3, 1.5, 1.5);
        }
      }
      ctx.strokeStyle = '#444'; ctx.lineWidth = 1.5; ctx.beginPath();
      if (f.state === 'hit' || f.state === 'stagger' || f.state === 'ragdoll') ctx.arc(0, 7, 4, 0, Math.PI);
      else { ctx.moveTo(-2, 6); ctx.lineTo(2, 6); }
      ctx.stroke(); ctx.restore();
    }
  }, []);

  // ─── GAME LOOP ────────────────────────────────────────
  useEffect(() => {
    if (gameScreen !== 'fight' && gameScreen !== 'campaignFight') return;
    const isCampaign = gameScreen === 'campaignFight';

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const g = G.current;
    const kd = (e: KeyboardEvent) => { g.keys.add(e.key.toLowerCase()); e.preventDefault(); };
    const ku = (e: KeyboardEvent) => { g.keys.delete(e.key.toLowerCase()); e.preventDefault(); };
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    let fc = 0, aid = 0;

    // Reset for new fight
    const midX = WORLD_W / 2;
    let char1: CharacterDef, char2: CharacterDef;
    let bossData: BossDef | null = null;
    if (isCampaign) {
      const cState = campaignRef.current;
      char1 = getCharacter(cState.playerCharId);
      bossData = getBoss(cState.level);
      char2 = bossData;
    } else {
      char1 = getCharacter(selectedP1);
      char2 = getCharacter(selectedP2);
    }
    g.fighters[0] = mkFighterFromChar(midX - 200, char1, !isCampaign);
    g.fighters[1] = mkFighterFromChar(midX + 200, char2, true);
    // Apply boss modifiers
    if (isCampaign && bossData) {
      g.fighters[1].hp = MAX_HP * bossData.hpMultiplier;
      // Scale body for bigger bosses
      for (const pt of g.fighters[1].rag.pts) {
        pt.pos.y -= (bossData.bodyScale - 1) * 20;
        pt.old.y -= (bossData.bodyScale - 1) * 20;
      }
    }
    g.blood = []; g.limbs = []; g.pools = []; g.sparks = []; g.gore = [];
    g.afterimages = []; g.rings = []; g.lightnings = []; g.bullets = []; g.muzzleFlashes = []; g.wallSparks = []; g.fatalityTexts = []; g.thrownSwords = []; g.specials = [];
    g.rs = 'intro'; g.introTimer = 100; g.timer = 99 * 60; g.round = 1;
    g.camX = midX;

    playSFX('roundStart', sfxVolume);

    const ss = (f: Fighter, state: FState, dur?: number) => {
      if (f.state === 'ragdoll' && state !== 'idle' && state !== 'ragdoll') { if (f.ragTimer > 0) return; f.ragdolling = false; }
      if (f.state === 'ko') return;
      f.state = state; f.frame = 0; f.dur = dur || 0; f.hitDealt = false;
    };
    const ca = (f: Fighter) => ['idle', 'walk', 'walkBack', 'crouch'].includes(f.state);
    const doAtk = (f: Fighter, t: string) => {
      if (!f.hasSword && ['slash', 'heavySlash', 'stab', 'overhead', 'spinSlash', 'dashStab', 'execution'].includes(t)) {
        t = pick(['punch', 'kick', 'headKick', 'kneeStrike', 'headbutt']);
      }
      const d = ATK[t]; if (!d || !ca(f) || f.stamina < d.stCost) return false;
      f.stamina -= d.stCost;
      ss(f, t as FState, Math.round(d.frames / (f.hasSword ? f.weapon.speed : 1.2)));
      if (t === 'dashStab') f.vx = f.facing * 12;
      if (t === 'uppercut') { f.vy = -6; f.grounded = false; }
      if (t === 'spinSlash') f.vx = f.facing * 5;
      if (t === 'backflipKick') { f.vy = -12; f.vx = -f.facing * 6; f.grounded = false; }
      if (t === 'execution') f.vx = f.facing * 8;
      if (t === 'wallFlip') { f.vy = -14; f.vx = f.facing * 10; f.grounded = false; f.wallSide = 0; f.wallRunTimer = 0; }
      if (t === 'divekick') { f.vy = 8; f.vx = f.facing * 6; f.grounded = false; }
      if (t === 'kick') f.vx = f.facing * 4;
      if (t === 'headKick') { f.vx = f.facing * 3; }
      if (t === 'kneeStrike') f.vx = f.facing * 6;
      if (t === 'roundhouse') { f.vx = f.facing * 3; }
      if (t === 'headbutt') { f.vx = f.facing * 8; }
      if (t === 'punch') { f.vx = f.facing * 5; }
      if (t === 'swordThrow') { f.vx = f.facing * 2; }
      playSFX('whoosh', sfxVolume * 0.5);
      spawnAfterimage(f); return true;
    };
    const doSwordThrow = (f: Fighter, idx: number) => {
      if (!f.hasSword || !ca(f) || f.stamina < 5) return false;
      f.stamina -= 5;
      f.hasSword = false;
      ss(f, 'swordThrow' as FState, 20);
      const hand = f.rag.pts[10].pos;
      const target = g.fighters[1 - idx];
      const ang = Math.atan2(target.y - 60 - hand.y, target.x - hand.x);
      g.thrownSwords.push({
        x: hand.x, y: hand.y, vx: Math.cos(ang) * 18, vy: Math.sin(ang) * 18 - 3,
        ang: ang, angV: f.facing * 0.8, life: 80, dmg: f.weapon.heavyDmg * 1.5,
        owner: idx, weapon: f.weapon, stuck: false,
      });
      playSFX('whoosh', sfxVolume);
      spawnAfterimage(f);
      return true;
    };
    const doFatality = (f: Fighter, o: Fighter) => {
      if (o.hp > 15 || !ca(f)) return false;
      const dist = Math.abs(f.x - o.x);
      if (dist > 80) return false;
      f.fatalityType = Math.floor(rng(0, FATALITIES.length));
      ss(f, 'fatality', FATALITIES[f.fatalityType].frames);
      g.slowMo = 0.3; g.slowTimer = FATALITIES[f.fatalityType].frames;
      g.fatalityTexts.push({ text: FATALITIES[f.fatalityType].name, life: 120, maxLife: 120 });
      spawnAfterimage(f);
      playSFX('heavyHit', sfxVolume * 2);
      // TTS fatality lines!
      if (ttsEnabled) {
        setTimeout(() => speakFighterLine(KO_WINNER_LINES, g.fighters.indexOf(f)), 500);
        setTimeout(() => speakFighterLine(KO_LOSER_LINES, g.fighters.indexOf(o)), 2000);
      }
      return true;
    };
    // ── UNIFIED SPECIAL ATTACK ──
    const doSpecial = (f: Fighter, idx: number) => {
      if (f.specialCooldown > 0 || !ca(f) || f.stamina < 40) return false;
      const charDef = getCharacter(f.charId);
      f.stamina -= 40; f.specialCooldown = 600;
      const specialState = (charDef.specialType === 'dragonStrike' ? 'dragonStrike' : charDef.specialType === 'skullFire' ? 'skullFire' : 'skullFire') as FState;
      ss(f, specialState, charDef.specialType === 'dragonStrike' ? 80 : 90);
      const target = g.fighters[1 - idx];
      g.specials.push({
        type: charDef.specialType, x: f.x + f.facing * 40, y: f.y - 80,
        facing: f.facing, life: 90, maxLife: 90, owner: idx,
        targetX: target.x, targetY: target.y - 60,
        particles: [], subEntities: [],
      });
      g.slowMo = 0.4; g.slowTimer = 25; g.flash = 10; g.flashColor = charDef.specialColor;
      spawnRing(f.x, f.y - 60, 120, charDef.specialColor);
      playSFX('heavyHit', sfxVolume * 1.5);
      if (ttsEnabled) speakFighterLine(charDef.specialLines, idx);
      return true;
    };
    const doShoot = (f: Fighter, idx: number) => {
      if (f.gunCooldown > 0 || f.severed.has('leftArm') || f.stamina < 4) return false;
      f.stamina -= 4; f.gunCooldown = 18; ss(f, 'shoot', 10); spawnBullet(f, idx); return true;
    };
    const startWallRun = (f: Fighter, side: -1 | 1) => {
      if (f.wallRunTimer > 0 || f.state === 'wallRun') return;
      f.state = 'wallRun' as FState; f.wallSide = side; f.wallRunTimer = 60; f.vy = -6; f.grounded = false;
    };
    const doDodge = (f: Fighter, dir: number) => {
      if (f.dodgeCool > 0 || f.stamina < 12) return;
      f.stamina -= 12; f.dodgeCool = 25; f.vx = dir * 10; ss(f, 'dodge' as FState, 18); spawnAfterimage(f);
    };
    const tryPickupLimb = (f: Fighter) => {
      if (f.heldLimb || !ca(f)) return false;
      let best: SevLimb | null = null, bestD = 80;
      for (const l of g.limbs) { if (!l.grounded) continue; const d = Math.abs(l.pts[0].x - f.x) + Math.abs(l.pts[0].y - (f.y)); if (d < bestD) { bestD = d; best = l; } }
      if (best) { f.heldLimb = best; g.limbs = g.limbs.filter(l => l.id !== best!.id); ss(f, 'pickup' as FState, 20); return true; }
      return false;
    };
    const doLimbSmash = (f: Fighter) => {
      if (!f.heldLimb || !ca(f) || f.stamina < 18) return false;
      f.stamina -= 18; f.vy = -9; f.grounded = false; ss(f, 'limbSmash' as FState, 36); spawnAfterimage(f); return true;
    };
    const throwLimb = (f: Fighter) => {
      if (!f.heldLimb) return;
      const limb = f.heldLimb; limb.pts = [v(f.rag.pts[7].pos.x, f.rag.pts[7].pos.y)];
      limb.vel = v(f.facing * 18, -8); limb.angV = f.facing * 1.2; limb.life = 300; limb.grounded = false;
      g.limbs.push(limb); f.heldLimb = null;
    };
    const startRagdoll = (f: Fighter, impulse: V, duration: number) => {
      f.ragdolling = true; f.ragTimer = duration; f.state = 'ragdoll' as FState; f.frame = 0; f.dur = duration;
      for (let i = 0; i < 11; i++) { const pt = f.rag.pts[i]; const imp = vscl(impulse, (1 - i * 0.05) * (0.7 + rng(0, 0.3))); pt.old = vsub(pt.pos, imp); }
      if (f.heldLimb) throwLimb(f);
    };

    // ═══════════════════════════════════════════════════════
    // AI
    // ═══════════════════════════════════════════════════════
    type AIStyle = 'berserker' | 'assassin' | 'guardian' | 'wild' | 'tactician' | 'showboat' | 'juggernaut' | 'gunslinger' | 'acrobat' | 'kickboxer';
    type AIIntent = 'pressure' | 'retreat' | 'circle' | 'feint' | 'punish' | 'bait' | 'rush' | 'rest' | 'jumpAtk' | 'dodgeIn' | 'taunt' | 'executeCombo' | 'pickupLimb' | 'limbAttack' | 'throwLimb' | 'shoot' | 'wallRun' | 'wallFlipAtk' | 'divekickAtk' | 'airCombo' | 'kickCombo' | 'fatalityAttempt' | 'specialAttack';

    const mkPersonality = () => ({
      style: pick(['berserker', 'assassin', 'guardian', 'wild', 'tactician', 'showboat', 'juggernaut', 'gunslinger', 'acrobat', 'kickboxer'] as AIStyle[]),
      aggression: 0.3 + rng(0, 0.7), patience: 0.1 + rng(0, 0.9), riskTaking: 0.2 + rng(0, 0.8),
      preferredAtk: pick(['slash', 'stab', 'heavySlash', 'overhead', 'kick', 'headKick'] as const),
      comboChance: 0.3 + rng(0, 0.5), dodgeSkill: 0.2 + rng(0, 0.6), tauntsAfterKill: rng(0, 1) > 0.5,
    });
    const mkAiMem = () => ({
      intent: 'pressure' as AIIntent, intentTimer: 0, timesHit: 0, consecutiveBlocks: 0,
      circleDir: Math.random() > 0.5 ? 1 : -1, styleShiftTimer: 80 + rng(0, 200),
      dashCooldown: 0, feinting: false, feintTimer: 0, comboStep: 0, rushMomentum: 0,
      comboSeq: [] as string[], lastAtkLanded: false, excitement: 0,
    });
    const aiData = [{ personality: mkPersonality(), mem: mkAiMem() }, { personality: mkPersonality(), mem: mkAiMem() }];

    const pickIntent = (bot: Fighter, pl: Fighter, p2: ReturnType<typeof mkPersonality>, m: ReturnType<typeof mkAiMem>): AIIntent => {
      const d = Math.abs(bot.x - pl.x);
      const hp = bot.hp / MAX_HP, plHp = pl.hp / MAX_HP, st = bot.stamina / 100;
      const r = Math.random();
      // Special attack check - use when cooldown is ready and enough stamina
      if (bot.specialCooldown <= 0 && st > 0.4 && r < 0.3 && d < 250) return 'specialAttack';
      if (pl.hp <= 35 && d < 80 && r < 0.6) return 'fatalityAttempt';
      const nearbyLimb = g.limbs.some(l => l.grounded && Math.abs(l.pts[0].x - bot.x) < 120);
      if (!bot.heldLimb && nearbyLimb && r < 0.2) return 'pickupLimb';
      if (bot.heldLimb && r < 0.25) return d < 100 ? 'limbAttack' : 'rush';
      const nearWall = bot.x < WALL_L + 60 || bot.x > WALL_R - 60;
      if (nearWall && r < 0.2 && st > 0.2) return 'wallRun';
      if (!bot.grounded && r < 0.2) return 'divekickAtk';
      if (d > 200 && r < 0.15) return 'shoot';
      if (d < 80 && r < 0.25) return 'kickCombo';
      if (hp < 0.15) return r < 0.4 ? 'rush' : r < 0.6 ? 'wallRun' : r < 0.8 ? 'shoot' : 'retreat';
      if (plHp < 0.15) return r < 0.25 ? 'fatalityAttempt' : r < 0.5 ? 'executeCombo' : r < 0.7 ? 'kickCombo' : 'pressure';
      if (st < 0.15) return r < 0.3 ? 'shoot' : 'rest';
      if (m.lastAtkLanded && r < 0.5) return r < 0.15 ? 'shoot' : r < 0.35 ? 'executeCombo' : r < 0.45 ? 'kickCombo' : 'pressure';
      switch (p2.style) {
        case 'berserker': return pick(['rush', 'pressure', 'pressure', 'executeCombo', 'jumpAtk', 'kickCombo']);
        case 'assassin': return pick(['feint', 'dodgeIn', 'punish', 'circle', 'shoot', 'kickCombo']);
        case 'guardian': return pick(['bait', 'circle', 'punish', 'retreat', 'shoot', 'pressure']);
        case 'kickboxer': return pick(['kickCombo', 'kickCombo', 'kickCombo', 'pressure', 'jumpAtk', 'divekickAtk', 'rush']);
        case 'wild': return pick(['rush', 'pressure', 'feint', 'jumpAtk', 'taunt', 'executeCombo', 'shoot', 'wallRun', 'divekickAtk', 'kickCombo']);
        case 'gunslinger': return pick(['shoot', 'shoot', 'retreat', 'dodgeIn', 'wallRun', 'pressure']);
        case 'acrobat': return pick(['wallRun', 'backflipKick' as AIIntent, 'jumpAtk', 'divekickAtk', 'wallFlipAtk', 'kickCombo']);
        case 'tactician': return d < 100 ? pick(['punish', 'circle', 'dodgeIn', 'shoot', 'kickCombo']) : pick(['pressure', 'feint', 'bait', 'shoot']);
        case 'showboat': return r < 0.1 ? 'taunt' : pick(['feint', 'pressure', 'executeCombo', 'kickCombo', 'wallRun']);
        case 'juggernaut': return pick(['pressure', 'pressure', 'rush', 'kickCombo', 'shoot']);
        default: return 'pressure';
      }
    };

    const AI_COMBOS = [
      ['slash', 'slash', 'stab', 'kick', 'headKick', 'stab', 'uppercut', 'jumpAtk', 'backflipKick', 'heavySlash'],
      ['kick', 'kick', 'kneeStrike', 'headKick', 'roundhouse', 'uppercut', 'backflipKick'],
      ['stab', 'kick', 'slash', 'kneeStrike', 'slash', 'uppercut', 'backflipKick', 'spinSlash'],
      ['dashStab', 'kick', 'kick', 'headKick', 'jumpAtk', 'backflipKick', 'overhead'],
      ['kneeStrike', 'kneeStrike', 'kick', 'headKick', 'roundhouse', 'heavySlash'],
      ['slash', 'stab', 'kick', 'stab', 'kick', 'headKick', 'heavySlash'],
      ['roundhouse', 'stab', 'slash', 'kick', 'uppercut', 'backflipKick', 'heavySlash'],
      ['uppercut', 'jumpAtk', 'backflipKick', 'execution'],
      ['kick', 'kick', 'kick', 'headKick', 'headKick', 'roundhouse', 'spinSlash'],
      ['dashStab', 'spinSlash', 'kick', 'headKick', 'heavySlash'],
      ['slash', 'kneeStrike', 'dashStab', 'uppercut', 'backflipKick'],
      ['headKick', 'headKick', 'headKick', 'roundhouse', 'execution'],
      ['backflipKick', 'kick', 'backflipKick', 'uppercut', 'jumpAtk'],
      ['wallFlip', 'kick', 'kick', 'headKick', 'backflipKick'],
      ['divekick', 'kneeStrike', 'kick', 'spinSlash', 'uppercut'],
      ['uppercut', 'divekick', 'kick', 'headKick', 'execution'],
      ['roundhouse', 'roundhouse', 'headKick', 'backflipKick', 'heavySlash'],
      ['kneeStrike', 'stab', 'kick', 'headKick', 'roundhouse', 'overhead'],
    ];

    const ai = (bot: Fighter, pl: Fighter, idx: number) => {
      if (bot.state === 'ko' || bot.state === 'ragdoll') return;
      const pers = aiData[idx].personality; const mem = aiData[idx].mem;
      bot.aiTimer--; bot.dodgeCool = Math.max(0, bot.dodgeCool - 1);
      mem.dashCooldown = Math.max(0, mem.dashCooldown - 1);
      mem.feintTimer = Math.max(0, mem.feintTimer - 1);
      mem.excitement = Math.max(0, mem.excitement - 0.02);
      mem.styleShiftTimer--;
      if (mem.styleShiftTimer <= 0) {
        pers.style = pick(['berserker', 'assassin', 'guardian', 'wild', 'tactician', 'showboat', 'juggernaut', 'gunslinger', 'acrobat', 'kickboxer'] as AIStyle[]);
        pers.aggression = 0.3 + rng(0, 0.7); pers.riskTaking = 0.2 + rng(0, 0.8);
        mem.styleShiftTimer = 60 + rng(0, 200); mem.circleDir *= -1;
      }
      if (bot.aiTimer > 0) return;
      if (['hit', 'stagger', 'pickup', 'fatality'].includes(bot.state) || bot.state === ('wallRun' as FState)) return;

      const d = Math.abs(bot.x - pl.x); const wr = bot.weapon.len + 25;
      const isPlAtk = ['slash', 'heavySlash', 'stab', 'overhead', 'jumpAtk', 'uppercut', 'spinSlash', 'dashStab', 'limbSmash', 'shoot', 'wallFlip', 'divekick', 'kick', 'headKick', 'kneeStrike', 'roundhouse'].includes(pl.state);
      const isPlRecovering = pl.dur > 0 && pl.frame > pl.dur * 0.6;
      const st = bot.stamina / 100;

      mem.intentTimer--;
      if (mem.intentTimer <= 0) { mem.intent = pickIntent(bot, pl, pers, mem); mem.intentTimer = 5 + Math.floor(rng(0, 12)); }

      if (isPlAtk && d < 120) {
        const r = Math.random();
        if (r < 0.1 && bot.shieldHP > 5) { ss(bot, 'block'); bot.aiTimer = 4 + rng(0, 5) | 0; return; }
        else if (r < 0.18 && bot.dodgeCool <= 0) { doDodge(bot, -bot.facing); bot.aiTimer = 3; return; }
        else if (r < 0.3) { doAtk(bot, pick(['kick', 'kneeStrike'])); bot.aiTimer = 0; return; }
        else if (r < 0.65 && ca(bot)) {
          doAtk(bot, pick(['slash', 'stab', 'uppercut', 'kick', 'headKick', 'roundhouse']));
          bot.aiTimer = 0; mem.intent = 'executeCombo'; mem.comboSeq = [...pick(AI_COMBOS)]; return;
        }
      }
      if (isPlRecovering && d < wr + 25 && ca(bot)) {
        doAtk(bot, pick(['slash', 'stab', 'kick', 'headKick', 'kneeStrike']));
        bot.aiTimer = 0; mem.intent = 'executeCombo'; mem.comboSeq = [...pick(AI_COMBOS)]; return;
      }

      switch (mem.intent) {
        case 'fatalityAttempt': {
          if (d > 80) { ss(bot, 'walk'); bot.vx += bot.facing * 5; bot.aiTimer = 1; }
          else if (ca(bot)) {
            if (doFatality(bot, pl)) { bot.aiTimer = FATALITIES[bot.fatalityType].frames; }
            else { mem.intent = 'pressure'; mem.intentTimer = 10; }
          }
          break;
        }
        case 'kickCombo': {
          if (d > 70) { ss(bot, 'walk'); bot.vx += bot.facing * 5; bot.aiTimer = 1; }
          else if (ca(bot)) {
            const kicks = ['kick', 'kick', 'headKick', 'kneeStrike', 'roundhouse', 'kick', 'headKick'];
            const k = pick(kicks);
            doAtk(bot, k); bot.aiTimer = 0;
            mem.comboStep++;
            if (mem.comboStep > 6) { mem.comboStep = 0; mem.intent = rng(0, 1) < 0.5 ? 'pressure' : 'executeCombo'; mem.comboSeq = [...pick(AI_COMBOS)]; }
          }
          break;
        }
        case 'shoot': {
          if (d < 60) { mem.intent = 'pressure'; break; }
          doShoot(bot, idx); bot.aiTimer = 6 + rng(0, 10) | 0;
          if (d < 150) bot.vx = -bot.facing * 4;
          if (rng(0, 1) < 0.4) { mem.intent = 'pressure'; mem.intentTimer = 10; }
          break;
        }
        case 'wallRun': {
          const nearLeft = bot.x < W / 2; const wallX = nearLeft ? WALL_L : WALL_R;
          if (Math.abs(bot.x - wallX) > 30) { bot.vx = nearLeft ? -5 : 5; ss(bot, 'walk'); bot.aiTimer = 1; }
          else if (bot.grounded) { startWallRun(bot, nearLeft ? -1 : 1); bot.aiTimer = 8; }
          else { mem.intent = 'pressure'; mem.intentTimer = 10; }
          break;
        }
        case 'wallFlipAtk': {
          const nearLeft2 = bot.x < W / 2;
          if (Math.abs(bot.x - (nearLeft2 ? WALL_L : WALL_R)) > 30 && bot.grounded) { bot.vx = nearLeft2 ? -5 : 5; ss(bot, 'walk'); bot.aiTimer = 1; }
          else if (bot.grounded) { startWallRun(bot, nearLeft2 ? -1 : 1); bot.aiTimer = 5; }
          else if (bot.state === 'wallRun') { doAtk(bot, 'wallFlip'); bot.aiTimer = 2; mem.intent = 'executeCombo'; mem.comboSeq = [...pick(AI_COMBOS)]; }
          else { mem.intent = 'pressure'; mem.intentTimer = 8; }
          break;
        }
        case 'divekickAtk': {
          if (bot.grounded) { bot.vy = -12; bot.grounded = false; bot.vx = bot.facing * 5; ss(bot, 'jump'); bot.aiTimer = 6; mem.intentTimer = 15; }
          else if (bot.y < GY - 50) { doAtk(bot, 'divekick'); bot.aiTimer = 2; mem.intent = 'pressure'; }
          else { mem.intent = 'pressure'; mem.intentTimer = 10; }
          break;
        }
        case 'airCombo': {
          if (bot.grounded) { bot.vy = -11; bot.grounded = false; bot.vx = bot.facing * 8; ss(bot, 'jump'); bot.aiTimer = 4; }
          else { doAtk(bot, pick(['jumpAtk', 'divekick', 'backflipKick'])); bot.aiTimer = 0; mem.intent = 'executeCombo'; mem.comboSeq = [...pick(AI_COMBOS)]; }
          break;
        }
        case 'pickupLimb': {
          const nearest = g.limbs.filter(l => l.grounded).sort((a, b) => Math.abs(a.pts[0].x - bot.x) - Math.abs(b.pts[0].x - bot.x))[0];
          if (nearest) { if (Math.abs(nearest.pts[0].x - bot.x) < 40) { tryPickupLimb(bot); bot.aiTimer = 8; mem.intent = 'pressure'; } else { bot.vx = Math.sign(nearest.pts[0].x - bot.x) * 4; ss(bot, 'walk'); bot.aiTimer = 2; } }
          else { mem.intent = 'pressure'; mem.intentTimer = 15; }
          break;
        }
        case 'limbAttack': {
          if (d > 80) { ss(bot, 'walk'); bot.vx += bot.facing * 4; bot.aiTimer = 1; }
          else if (ca(bot)) { doLimbSmash(bot); bot.aiTimer = 2 + rng(0, 4) | 0; mem.intent = 'pressure'; }
          break;
        }
        case 'throwLimb': { if (bot.heldLimb && ca(bot)) { throwLimb(bot); bot.aiTimer = 5; mem.intent = 'rush'; } break; }
        case 'pressure': {
          if (d > wr + 15) { ss(bot, 'walk'); bot.aiTimer = 1; if (d > 100 && rng(0, 1) < 0.5 && mem.dashCooldown <= 0) { bot.vx = bot.facing * (10 + rng(0, 6)); mem.dashCooldown = 8; } if (d > 150 && rng(0, 1) < 0.25) doShoot(bot, idx); }
          else if (ca(bot) && st > 0.06) {
            const r = Math.random();
            if (r < 0.08) doAtk(bot, 'kick');
            else if (r < 0.14) doAtk(bot, 'headKick');
            else if (r < 0.19) doAtk(bot, 'kneeStrike');
            else if (r < 0.24) doAtk(bot, 'roundhouse');
            else if (r < 0.30) doAtk(bot, 'headbutt');
            else if (r < 0.35) doAtk(bot, 'punch');
            else if (r < 0.42) doAtk(bot, 'slash');
            else if (r < 0.48) doAtk(bot, 'stab');
            else if (r < 0.53) doAtk(bot, 'dashStab');
            else if (r < 0.58) doAtk(bot, 'uppercut');
            else if (r < 0.63) doAtk(bot, 'spinSlash');
            else if (r < 0.68) doAtk(bot, 'heavySlash');
            else if (r < 0.73) doAtk(bot, 'backflipKick');
            else if (r < 0.78) { doShoot(bot, idx); }
            else if (r < 0.82 && bot.hasSword && d > 120) { doSwordThrow(bot, idx); }
            else doAtk(bot, pers.preferredAtk);
            bot.aiTimer = 1; mem.comboStep++;
            if (mem.comboStep < 8 && rng(0, 1) < 0.85) bot.aiTimer = 0; else mem.comboStep = 0;
          } else { ss(bot, 'walk'); bot.aiTimer = 1; }
          break;
        }
        case 'executeCombo': {
          if (mem.comboSeq.length === 0) mem.comboSeq = [...pick(AI_COMBOS)];
          if (d > wr + 10) { ss(bot, 'walk'); bot.vx += bot.facing * 6; bot.aiTimer = 1; }
          else if (ca(bot) && mem.comboSeq.length > 0) {
            const next = mem.comboSeq.shift()!;
            if (next === 'wallFlip') { mem.intent = 'wallFlipAtk'; mem.intentTimer = 20; }
            else if (next === 'divekick') { mem.intent = 'divekickAtk'; mem.intentTimer = 15; }
            else if (doAtk(bot, next)) bot.aiTimer = 0;
            else { mem.comboSeq = []; mem.intent = 'retreat'; mem.intentTimer = 10; }
            if (mem.comboSeq.length === 0) { mem.intent = rng(0, 1) < 0.7 ? 'pressure' : 'taunt'; mem.intentTimer = 8; }
          }
          break;
        }
        case 'retreat': {
          if (d < 160) { ss(bot, 'walkBack'); bot.aiTimer = 2 + rng(0, 4) | 0; if (rng(0, 1) < 0.3) doShoot(bot, idx); }
          else { mem.intent = rng(0, 1) < 0.6 ? 'pressure' : 'circle'; mem.intentTimer = 15; }
          if (d < wr && ca(bot) && rng(0, 1) < 0.4) doAtk(bot, pick(['stab', 'kick']));
          break;
        }
        case 'circle': {
          bot.vx = mem.circleDir * 4;
          if (d < 80) bot.vx += -bot.facing * 2.5; else if (d > 180) ss(bot, 'walk'); else ss(bot, rng(0, 1) > 0.5 ? 'walk' : 'walkBack');
          bot.aiTimer = 2 + rng(0, 5) | 0;
          if (d < wr + 5 && rng(0, 1) < 0.4 && ca(bot)) doAtk(bot, pick(['slash', 'kick', 'headKick', 'stab']));
          break;
        }
        case 'feint': {
          if (d > wr + 30) { ss(bot, 'walk'); bot.aiTimer = 1 + rng(0, 3) | 0; }
          else if (mem.feintTimer <= 0) {
            if (!mem.feinting) { mem.feinting = true; bot.vx = bot.facing * 6; ss(bot, 'walk'); bot.aiTimer = 2; }
            else { mem.feinting = false; mem.feintTimer = 10 + rng(0, 15); if (ca(bot)) doAtk(bot, pick(['slash', 'stab', 'kick', 'headKick'])); bot.aiTimer = 1; }
          } else { ss(bot, 'walk'); bot.aiTimer = 2; }
          break;
        }
        case 'punish': { if (d > wr) { ss(bot, 'walk'); bot.vx += bot.facing * 5; bot.aiTimer = 1; } else if (ca(bot)) { doAtk(bot, pick(['heavySlash', 'roundhouse', 'headKick'])); bot.aiTimer = 1; mem.intent = 'pressure'; } break; }
        case 'bait': { if (d < 100) { ss(bot, 'walkBack'); bot.aiTimer = 2; } else if (d < 200) { ss(bot, 'idle'); bot.aiTimer = 3; } else { mem.intent = 'pressure'; } if (isPlAtk && d < wr + 20 && ca(bot)) { doAtk(bot, pick(['stab', 'kick'])); mem.intent = 'executeCombo'; } break; }
        case 'rush': {
          mem.rushMomentum += 2;
          if (d > wr) { bot.vx = bot.facing * (8 + mem.rushMomentum * 0.4); ss(bot, 'walk'); bot.aiTimer = 0; }
          else if (ca(bot)) { doAtk(bot, pick(['dashStab', 'slash', 'heavySlash', 'kick', 'headKick'])); mem.rushMomentum = 0; bot.aiTimer = 0; mem.intent = 'executeCombo'; mem.comboSeq = [...pick(AI_COMBOS)]; }
          if (mem.rushMomentum > 20) { mem.rushMomentum = 0; mem.intent = 'pressure'; }
          break;
        }
        case 'rest': {
          if (d < 100) { ss(bot, 'walkBack'); bot.vx = -bot.facing * 3; } else { ss(bot, 'idle'); }
          bot.aiTimer = 3 + rng(0, 5) | 0;
          if (bot.stamina > 40) { mem.intent = rng(0, 1) < 0.5 ? 'pressure' : 'circle'; }
          break;
        }
        case 'jumpAtk': {
          if (bot.grounded) { bot.vy = -11; bot.grounded = false; bot.vx = bot.facing * 8; ss(bot, 'jump'); bot.aiTimer = 4; }
          else if (!bot.grounded && ca(bot)) { doAtk(bot, 'jumpAtk'); bot.aiTimer = 1; mem.intent = 'executeCombo'; mem.comboSeq = [...pick(AI_COMBOS)]; }
          break;
        }
        case 'dodgeIn': {
          if (d > wr + 30) { doDodge(bot, bot.facing); bot.aiTimer = 4; }
          else if (d < wr + 10 && ca(bot)) { doAtk(bot, pick(['stab', 'slash', 'kick'])); bot.aiTimer = 1; mem.intent = 'executeCombo'; mem.comboSeq = [...pick(AI_COMBOS)]; }
          else { mem.intent = 'pressure'; mem.intentTimer = 5; }
          break;
        }
        case 'taunt': { if (ca(bot)) { ss(bot, 'taunt', 30); bot.aiTimer = 15; mem.intent = 'pressure'; } break; }
        case 'specialAttack': {
          if (bot.specialCooldown > 0) { mem.intent = 'pressure'; break; }
          doSpecial(bot, idx);
          bot.aiTimer = 30; mem.intent = 'pressure'; mem.intentTimer = 30;
          break;
        }
      }
    };

    // ── TICK ──
    const tick = () => {
      fc++;
      if (g.slowTimer > 0) { g.slowTimer--; if (g.slowTimer <= 0) g.slowMo = 1; }
      if (g.flash > 0) g.flash -= 0.5;
      g.bgTime += 0.016;
      const spd = g.slowMo;
      const [p1, p2] = g.fighters;

      if (g.rs === 'intro') {
        g.introTimer -= spd; if (g.introTimer <= 0) { g.rs = 'fight'; playSFX('roundStart', sfxVolume); }
        p1.facing = 1; p2.facing = -1;
        if (p1.x < 450) { p1.x += 2; ss(p1, 'walk'); }
        if (p2.x > 830) { p2.x -= 2; ss(p2, 'walk'); }
      }

      if (g.rs === 'ko') {
        g.koTimer -= spd;
        const winner = p1.hp > 0 ? p1 : p2.hp > 0 ? p2 : null;
        const loser = p1.hp <= 0 ? p1 : p2.hp <= 0 ? p2 : null;
        if (winner && loser && g.koTimer > 0) {
          winner.groundBeatTimer += spd;
          winner.stamina = 100;
          winner.facing = loser.x > winner.x ? 1 : -1;
          const dToLoser = Math.abs(winner.x - loser.rag.pts[4].pos.x);
          if (dToLoser > 50) {
            winner.x += winner.facing * 3 * spd;
            ss(winner, 'walk');
          } else if (ca(winner) || winner.state === 'idle') {
            // Only attack every ~20 frames to prevent jitter
            if (winner.groundBeatTimer % 20 < spd) {
              const beatAtk = pick(['kick', 'headKick', 'kneeStrike', 'punch', 'headbutt', 'roundhouse']);
              doAtk(winner, beatAtk);
              const hitPt = loser.rag.pts[Math.floor(rng(0, loser.rag.pts.length))].pos;
              spawnBlood(hitPt.x, hitPt.y, winner.facing, 15, 2.5);
              spawnGore(hitPt.x, hitPt.y, 2, winner.facing);
              // Gentle push on loser ragdoll (not every frame!)
              for (let i = 0; i < loser.rag.pts.length; i++) {
                loser.rag.pts[i].old = vsub(loser.rag.pts[i].pos, v(winner.facing * rng(1, 4), -rng(1, 3)));
              }
              spawnRing(hitPt.x, hitPt.y, 40, '#f80'); playSFX('hit', sfxVolume * 0.5);
            }
            // Beatdown TTS
            if (ttsEnabled && winner.groundBeatTimer > 60 && fc % 90 === 0) {
              const wIdx = g.fighters.indexOf(winner);
              const lIdx = g.fighters.indexOf(loser);
              if (rng(0, 1) < 0.5) speakFighterLine(BEATDOWN_LINES_WINNER, wIdx);
              else speakFighterLine(BEATDOWN_LINES_LOSER, lIdx);
            }
          }
          // Smooth ragdoll stepping for both
          stepRagdoll(winner.rag.pts, winner.rag.sticks, spd, 0.3);
          clampRagdollToArena(winner);
          if (!winner.ragdolling) poseRagdoll(winner);
          stepRagdoll(loser.rag.pts, loser.rag.sticks, spd, 0.4);
          clampRagdollToArena(loser);
          if (!winner.grounded) { winner.vy += GRAV * spd; winner.y += winner.vy * spd; if (winner.y >= GY) { winner.y = GY; winner.vy = 0; winner.grounded = true; } }
          winner.x += winner.vx * spd; winner.vx *= 0.86;
          winner.x = clamp(winner.x, WALL_L, WALL_R);
          winner.bob += 0.04 * spd;
          // Dampen loser velocity to prevent jitter
          for (const pt of loser.rag.pts) {
            const vel = vsub(pt.pos, pt.old);
            pt.old = vlerp(pt.old, pt.pos, 0.15); // heavy damping
          }
          // Keep loser position synced to ragdoll center
          const loserCenter = loser.rag.pts[4].pos;
          loser.x = clamp(loserCenter.x, WALL_L, WALL_R);
          loser.y = Math.min(loserCenter.y, GY);
        }
        if (g.koTimer <= 0) {
          // Campaign mode: check win/loss
          if (isCampaign) {
            const playerWon = p1.hp > 0;
            const cState = campaignRef.current;
            const timeUsed = Math.ceil((99 * 60 - g.timer) / 60);
            const levelScore = playerWon ? Math.max(100, 1000 - timeUsed * 5 + p1.combo * 50 + (p1.hp / MAX_HP) * 500) : 0;
            if (playerWon) {
              cState.levelScores.push(Math.round(levelScore));
              cState.totalScore += Math.round(levelScore);
              cState.totalTime += timeUsed;
              cState.bestCombo = Math.max(cState.bestCombo, p1.combo);
              cState.levelsComplete[cState.level - 1] = true;
              if (cState.level >= 12) {
                setCampaign({ ...cState });
                setGameScreen('victory');
              } else {
                cState.level++;
                setCampaign({ ...cState });
                setGameScreen('cinematic');
              }
            } else {
              // Player lost - retry same level
              setCampaign({ ...cState });
              setGameScreen('cinematic');
            }
            return;
          }
          g.round++;
          const midX2 = (p1.x + p2.x) / 2;
          const c1 = getCharacter(p1.charId); const c2 = getCharacter(p2.charId);
          const f1 = mkFighterFromChar(midX2 - 200, c1, true);
          const f2 = mkFighterFromChar(midX2 + 200, c2, true);
          f1.wins = p1.wins; f2.wins = p2.wins;
          g.fighters[0] = f1; g.fighters[1] = f2;
          g.blood = []; g.limbs = []; g.pools = []; g.sparks = []; g.gore = [];
          g.afterimages = []; g.rings = []; g.lightnings = []; g.bullets = []; g.muzzleFlashes = []; g.wallSparks = []; g.fatalityTexts = []; g.thrownSwords = []; g.specials = [];
          g.rs = 'intro'; g.introTimer = 80; g.timer = 99 * 60;
          aiData[0] = { personality: mkPersonality(), mem: mkAiMem() }; aiData[1] = { personality: mkPersonality(), mem: mkAiMem() };
          playSFX('roundStart', sfxVolume);
        }
      }

      if (g.rs !== 'fight' && g.rs !== 'ko') {
        g.fighters.forEach(f => { if (f.ragdolling) { stepRagdoll(f.rag.pts, f.rag.sticks, spd, 0.3); clampRagdollToArena(f); } });
        if (fc % 3 === 0) setHud({ p1hp: p1.hp, p2hp: p2.hp, timer: Math.ceil(g.timer / 60), round: g.round, p1st: p1.stamina, p2st: p2.stamina, p1w: p1.wins, p2w: p2.wins, rs: g.rs, n1: p1.name, n2: p2.name, w1: p1.weapon.name, w2: p2.weapon.name, p1limb: !!p1.heldLimb, p2limb: !!p2.heldLimb });
        return;
      }
      if (g.rs === 'ko') {
        g.blood = g.blood.filter(b => { if (b.grounded) { b.life -= spd * 0.15; return b.life > 0; } b.x += b.vx * spd; b.y += b.vy * spd; b.vy += 0.35 * spd; b.vx *= 0.99; b.life -= spd; if (b.y >= GY) { b.grounded = true; b.y = GY; b.vy = 0; b.vx = 0; if (g.pools.length < 180) { const ex = g.pools.find(p3 => Math.abs(p3.x - b.x) < 25); if (ex) ex.r = Math.min(55, ex.r + 1.5); else g.pools.push({ x: b.x, y: GY, r: 3 + rng(0, 7), a: 0.85 }); } } return b.life > 0; });
        g.sparks = g.sparks.filter(s2 => { s2.x += s2.vx * spd; s2.y += s2.vy * spd; s2.vy += 0.4 * spd; s2.life -= spd; return s2.life > 0; });
        g.gore = g.gore.filter(gc => { gc.x += gc.vx * spd; gc.y += gc.vy * spd; gc.vy += 0.3 * spd; gc.rot += gc.rotV * spd; if (gc.y >= GY) { gc.y = GY; gc.vy *= -0.3; gc.vx *= 0.6; } gc.life -= spd; return gc.life > 0; });
        g.afterimages = g.afterimages.filter(a => { a.alpha -= 0.03; return a.alpha > 0; });
        g.rings = g.rings.filter(r => { r.r += (r.maxR - r.r) * 0.15; r.life -= 0.06; return r.life > 0; });
        if (fc % 3 === 0) setHud({ p1hp: p1.hp, p2hp: p2.hp, timer: Math.ceil(g.timer / 60), round: g.round, p1st: p1.stamina, p2st: p2.stamina, p1w: p1.wins, p2w: p2.wins, rs: g.rs, n1: p1.name, n2: p2.name, w1: p1.weapon.name, w2: p2.weapon.name, p1limb: !!p1.heldLimb, p2limb: !!p2.heldLimb });
        if (g.rs === 'ko') return;
      }

      g.timer--;
      if (g.timer <= 0) {
        if (p1.hp >= p2.hp) { p1.wins++; ss(p2, 'ko'); startRagdoll(p2, v(5, -8), 999); }
        else { p2.wins++; ss(p1, 'ko'); startRagdoll(p1, v(-5, -8), 999); }
        g.rs = 'ko'; g.koTimer = 180;
        playSFX('ko', sfxVolume);
        if (ttsEnabled) speakAnnouncer(pick(KO_ANNOUNCER_LINES));
      }

      // ── PLAYER INPUT (campaign mode) ──
      if (isCampaign && p1.state !== 'ko' && p1.state !== 'ragdoll') {
        const keys = g.keys;
        const gpad = readGamepad();
        const kLeft = keys.has('a') || keys.has('arrowleft') || gpad.left;
        const kRight = keys.has('d') || keys.has('arrowright') || gpad.right;
        const kUp = keys.has('w') || keys.has('arrowup') || gpad.up;
        const kDown = keys.has('s') || keys.has('arrowdown') || gpad.down;
        const kSlash = keys.has('j') || keys.has('z') || gpad.slash;
        const kHeavy = keys.has('k') || keys.has('x') || gpad.heavySlash;
        const kKick = keys.has('l') || keys.has('c') || gpad.kick;
        const kBlock = keys.has('shift') || gpad.block;
        const kSpecial = (keys.has('q') && keys.has('e')) || gpad.special;
        const kDodge = keys.has(' ') || gpad.dodge;
        const kShoot = keys.has('f') || gpad.shoot;
        const kGrab = keys.has('g') || gpad.grab;

        if (ca(p1)) {
          if (kSpecial && p1.specialCooldown <= 0) { doSpecial(p1, 0); }
          else if (kBlock) { ss(p1, 'block'); }
          else if (kDodge && p1.dodgeCool <= 0) { doDodge(p1, kLeft ? -1 : kRight ? 1 : -p1.facing); }
          else if (kSlash && kUp) { doAtk(p1, 'uppercut'); }
          else if (kSlash && kDown) { doAtk(p1, 'stab'); }
          else if (kSlash) { doAtk(p1, 'slash'); }
          else if (kHeavy && kDown) { doAtk(p1, 'overhead'); }
          else if (kHeavy && kUp) { doAtk(p1, 'spinSlash'); }
          else if (kHeavy) { doAtk(p1, 'heavySlash'); }
          else if (kKick && kUp) { doAtk(p1, 'headKick'); }
          else if (kKick && kDown) { doAtk(p1, 'kneeStrike'); }
          else if (kKick) { doAtk(p1, pick(['kick', 'roundhouse'])); }
          else if (kShoot) { doShoot(p1, 0); }
          else if (kGrab) { if (p1.heldLimb) doLimbSmash(p1); else tryPickupLimb(p1); }
          else if (kUp && p1.grounded) { p1.vy = -11; p1.grounded = false; ss(p1, 'jump' as FState); }
          else if (kLeft) { ss(p1, p1.facing < 0 ? 'walk' : 'walkBack'); }
          else if (kRight) { ss(p1, p1.facing > 0 ? 'walk' : 'walkBack'); }
          else if (kDown) { ss(p1, 'crouch'); }
          else { ss(p1, 'idle'); }
        } else if (p1.state === 'block' && !kBlock) {
          ss(p1, 'idle');
        }
        // Airborne attacks
        if (!p1.grounded && kSlash && ca(p1)) doAtk(p1, 'jumpAtk');
        if (!p1.grounded && kKick && ca(p1)) doAtk(p1, 'divekick');
      } else if (!isCampaign) {
        // AI vs AI mode
        ai(p1, p2, 0);
      }
      ai(p2, p1, 1);

      // Update fighters
      g.fighters.forEach((f, idx) => {
        const o = g.fighters[1 - idx];
        if (ca(f)) f.facing = o.x > f.x ? 1 : -1;
        if (f.dur > 0) { f.frame += spd; if (f.frame >= f.dur) { if (f.state === 'ragdoll') { f.ragTimer -= spd; if (f.ragTimer <= 0 && f.hp > 0) { f.ragdolling = false; ss(f, 'idle'); } } else if (f.state !== 'ko') ss(f, 'idle'); } }
        if (f.ragdolling && f.state === 'ragdoll') { f.ragTimer -= spd; if (f.ragTimer <= 0 && f.hp > 0) { f.ragdolling = false; ss(f, 'idle'); } }
        if (ca(f) || f.state === 'block') f.stamina = Math.min(100, f.stamina + 0.35);
        f.dodgeCool = Math.max(0, f.dodgeCool - spd);
        if (f.specialCooldown > 0) f.specialCooldown -= spd;
        if (f.gunCooldown > 0) f.gunCooldown -= spd;
        if (f.muzzleFlash > 0) f.muzzleFlash -= spd;

        if (f.state === 'wallRun') {
          f.wallRunTimer -= spd; f.vy = -4.5; f.y += f.vy * spd; f.walkCycle += 0.25 * spd;
          if (f.wallSide < 0) f.x = WALL_L + 5; else f.x = WALL_R - 5;
          if (fc % 4 === 0) spawnWallSparks(f.x, f.y - 30, 3, -f.wallSide);
          if (f.y < 120 || f.wallRunTimer <= 0) { f.facing = -f.wallSide as 1 | -1; doAtk(f, 'wallFlip'); }
          if (fc % 3 === 0) spawnAfterimage(f);
        }

        if (!f.grounded && f.state !== 'wallRun') {
          f.vy += GRAV * spd; f.y += f.vy * spd;
          if (f.y >= GY) { f.y = GY; f.vy = 0; f.grounded = true; if (f.state === 'jump') ss(f, 'idle');
            if (f.state === 'divekick') { spawnRing(f.x, GY, 60, '#fa0'); for (let i = 0; i < 8; i++) g.sparks.push({ x: f.x + rng(-20, 20), y: GY, vx: rng(-6, 6), vy: -rng(3, 10), life: 10 + rng(0, 8), color: '#fa0', sz: 1.5 + rng(0, 2) }); playSFX('heavyHit', sfxVolume); }
          }
        }
        if (f.isAI && !f.grounded && f.state !== 'wallRun' && f.state !== 'wallFlip') {
          if (f.x <= WALL_L + 10 && rng(0, 1) < 0.4) startWallRun(f, -1);
          else if (f.x >= WALL_R - 10 && rng(0, 1) < 0.4) startWallRun(f, 1);
        }

        f.x += f.vx * spd; f.vx *= 0.88;
        if (f.state === 'walk') { f.x += f.facing * 3.0 * spd; f.walkCycle += 0.12 * spd; }
        else if (f.state === 'walkBack') { f.x -= f.facing * 2.2 * spd; f.walkCycle += 0.1 * spd; }
        f.x = clamp(f.x, WALL_L, WALL_R); f.bob += 0.04 * spd;
        if (f.hitImpact > 0) f.hitImpact *= 0.84;
        if (f.state === 'limbSmash') { const ap2 = f.dur > 0 ? f.frame / f.dur : 0; f.limbSwingAng = ap2 < 0.3 ? -2.5 : ap2 < 0.6 ? 2.0 : 0; } else { f.limbSwingAng *= 0.85; }

        const ap2 = f.dur > 0 ? f.frame / f.dur : 0;
        if (f.state === 'slash') f.wTarget = ap2 < 0.3 ? -2.0 : ap2 < 0.55 ? 1.5 : 0.3;
        else if (f.state === 'heavySlash') f.wTarget = ap2 < 0.35 ? -2.5 : ap2 < 0.6 ? 2.2 : 0.2;
        else if (f.state === 'stab') f.wTarget = ap2 < 0.3 ? -0.3 : ap2 < 0.55 ? 0.15 : -0.3;
        else if (f.state === 'overhead') f.wTarget = ap2 < 0.4 ? -2.8 : ap2 < 0.6 ? 2.0 : -0.2;
        else if (f.state === 'jumpAtk') f.wTarget = ap2 < 0.25 ? -2.5 : ap2 < 0.65 ? 2.5 : 0.5;
        else if (f.state === 'uppercut') f.wTarget = ap2 < 0.3 ? -1.0 : ap2 < 0.5 ? -2.8 : -0.5;
        else if (f.state === 'spinSlash') { f.wTarget = Math.sin(ap2 * Math.PI * 2) * 2.5; }
        else if (f.state === 'dashStab') f.wTarget = ap2 < 0.2 ? -0.2 : ap2 < 0.7 ? 0.1 : -0.3;
        else if (f.state === 'backflipKick') f.wTarget = -1.5 + Math.sin(ap2 * Math.PI * 2) * 1.5;
        else if (f.state === 'execution') { f.wTarget = ((ap2 * 5) % 1) < 0.4 ? -2.5 : ((ap2 * 5) % 1) < 0.6 ? 2.5 : 0; }
        else if (f.state === 'fatality') { f.wTarget = Math.sin(ap2 * Math.PI * 4) * 2.5; }
        else if (f.state === 'wallFlip') f.wTarget = Math.sin(ap2 * Math.PI * 2.5) * 2.5;
        else if (f.state === 'divekick') f.wTarget = 1.0;
        else if (f.state === 'block') f.wTarget = -1.2;
        else if (f.state === 'kick' || f.state === 'headKick' || f.state === 'kneeStrike' || f.state === 'roundhouse') f.wTarget = -0.8;
        else if (f.state === 'headbutt' || f.state === 'punch' || f.state === 'swordThrow') f.wTarget = -0.5;
        else f.wTarget = -0.5;
        f.wAngle += (f.wTarget - f.wAngle) * 0.32;
        if (f.state === 'dodge') f.vx = (f.facing === 1 ? -1 : 1) * 8 * (1 - ap2);

        if (f.bleedTimer > 0) { f.bleedTimer -= spd; f.severed.forEach(part => { const pidx = part === 'leftArm' ? 5 : part === 'rightArm' ? 8 : part === 'leftLeg' ? 11 : part === 'rightLeg' ? 14 : 1; if (fc % 4 === 0 && f.rag.pts[pidx]) spawnBlood(f.rag.pts[pidx].pos.x, f.rag.pts[pidx].pos.y, rng(-1, 1), 4, 2.5); }); }
        if (f.comboTimer > 0) { f.comboTimer -= spd; if (f.comboTimer <= 0) f.combo = 0; }
        stepRagdoll(f.rag.pts, f.rag.sticks, spd, 0.3);
        clampRagdollToArena(f);
        if (!f.ragdolling) poseRagdoll(f);
        if (['slash', 'heavySlash', 'stab', 'overhead', 'jumpAtk', 'uppercut', 'spinSlash', 'dashStab', 'backflipKick', 'execution', 'wallFlip', 'divekick', 'kick', 'headKick', 'roundhouse', 'fatality', 'headbutt', 'punch', 'swordThrow', 'skullFire', 'dragonStrike'].includes(f.state) && fc % 3 === 0) spawnAfterimage(f);
      });

      // ── FIGHTER-TO-FIGHTER COLLISION ──
      {
        const MIN_DIST = 45;
        const dx = p2.x - p1.x;
        const dist = Math.abs(dx);
        if (dist < MIN_DIST && dist > 0.1) {
          const push = (MIN_DIST - dist) * 0.5;
          const dir = dx > 0 ? 1 : -1;
          if (p1.state !== 'ko' && p1.state !== 'ragdoll') { p1.x -= dir * push; p1.vx -= dir * 0.5; }
          if (p2.state !== 'ko' && p2.state !== 'ragdoll') { p2.x += dir * push; p2.vx += dir * 0.5; }
          p1.x = clamp(p1.x, WALL_L, WALL_R);
          p2.x = clamp(p2.x, WALL_L, WALL_R);
        }
      }

      // ── UNIFIED SPECIAL ENTITY UPDATES ──
      g.specials = g.specials.filter(sp => {
        sp.life -= spd;
        const progress = 1 - sp.life / sp.maxLife;
        const target = g.fighters[1 - sp.owner];
        const charDef = getCharacter(g.fighters[sp.owner].charId);

        // Spawn particles based on type
        if (progress > 0.15 && progress < 0.85 && fc % 2 === 0) {
          const col = charDef.specialColor;
          if (sp.type === 'skullFire' || sp.type === 'fireTornado' || sp.type === 'meteorRain') {
            for (let i = 0; i < 4; i++) sp.particles.push({ x: sp.x + sp.facing * 30, y: sp.y + rng(-10, 10), vx: sp.facing * (8 + rng(0, 12)), vy: rng(-3, 3), life: 20 + rng(0, 15), sz: 3 + rng(0, 6), color: col });
          } else if (sp.type === 'iceBlast') {
            for (let i = 0; i < 3; i++) sp.particles.push({ x: sp.x + sp.facing * rng(20, 150), y: sp.y + rng(-20, 20), vx: sp.facing * rng(2, 6), vy: rng(-2, 2), life: 15 + rng(0, 10), sz: 2 + rng(0, 5), color: '#8ef' });
          } else if (sp.type === 'poisonCloud') {
            for (let i = 0; i < 5; i++) sp.particles.push({ x: sp.targetX + rng(-60, 60), y: sp.targetY + rng(-40, 40), vx: rng(-2, 2), vy: rng(-3, 1), life: 25 + rng(0, 15), sz: 5 + rng(0, 10), color: '#4f4' });
          } else if (sp.type === 'earthquake') {
            for (let i = 0; i < 3; i++) sp.particles.push({ x: sp.x + sp.facing * rng(10, 200), y: GY - rng(0, 20), vx: rng(-3, 3), vy: -rng(2, 8), life: 12 + rng(0, 8), sz: 3 + rng(0, 5), color: '#a80' });
          } else if (sp.type === 'lightningStorm' && fc % 6 === 0) {
            spawnLightning(target.x + rng(-80, 80), -50, target.x + rng(-40, 40), GY);
          } else if (sp.type === 'shadowClone') {
            for (let i = 0; i < 2; i++) sp.particles.push({ x: sp.x + sp.facing * rng(10, 80), y: sp.y + rng(-30, 30), vx: sp.facing * rng(3, 8), vy: rng(-2, 2), life: 10 + rng(0, 8), sz: 4 + rng(0, 6), color: '#a0f' });
          } else if (sp.type === 'bloodFrenzy') {
            for (let i = 0; i < 3; i++) sp.particles.push({ x: g.fighters[sp.owner].x + rng(-30, 30), y: g.fighters[sp.owner].y - 60 + rng(-30, 30), vx: rng(-3, 3), vy: -rng(1, 5), life: 15 + rng(0, 10), sz: 3 + rng(0, 4), color: '#f00' });
          } else if (sp.type === 'boulderThrow') {
            sp.x += sp.facing * 10 * spd;
            for (let i = 0; i < 2; i++) sp.particles.push({ x: sp.x + rng(-10, 10), y: sp.y + rng(-10, 10), vx: -sp.facing * rng(1, 4), vy: rng(-2, 2), life: 8 + rng(0, 6), sz: 2 + rng(0, 3), color: '#a96' });
          } else if (sp.type === 'soulHarvest') {
            for (let i = 0; i < 3; i++) sp.particles.push({ x: sp.x + sp.facing * rng(20, 120), y: sp.y + rng(-40, 40), vx: sp.facing * rng(2, 6), vy: -rng(0, 3), life: 18 + rng(0, 12), sz: 4 + rng(0, 6), color: '#8f8' });
          } else if (sp.type === 'dragonStrike') {
            sp.x += sp.facing * 8 * spd;
            if (progress > 0.35 && progress < 0.7) { sp.y = GY - 120 + Math.sin((progress - 0.35) / 0.35 * Math.PI) * 60; }
            else if (progress >= 0.7) { sp.y -= 5 * spd; }
            for (let i = 0; i < 2; i++) sp.particles.push({ x: sp.x + rng(-15, 15), y: sp.y + rng(-10, 10), vx: -sp.facing * rng(1, 4), vy: rng(-2, 2), life: 10, sz: 3 + rng(0, 4), color: '#08f' });
          }
        }

        // Movement for specific types
        if (progress < 0.2 && (sp.type === 'skullFire' || sp.type === 'fireTornado')) sp.y -= 1.5 * spd;
        if (sp.type === 'shadowClone' || sp.type === 'iceBlast' || sp.type === 'soulHarvest') sp.x += sp.facing * 5 * spd;
        if (sp.type === 'bloodFrenzy') { const owner = g.fighters[sp.owner]; owner.hp = Math.min(MAX_HP, owner.hp + 0.15); sp.x = owner.x; sp.y = owner.y - 60; }

        // Damage target
        if (progress > 0.15 && progress < 0.85 && target.state !== 'ko' && target.state !== 'dodge' && fc % 8 === 0) {
          let inRange = false;
          if (sp.type === 'poisonCloud') { inRange = Math.abs(target.x - sp.targetX) < 80 && Math.abs(target.y - 60 - sp.targetY) < 60; }
          else if (sp.type === 'earthquake') { inRange = Math.abs(target.y - GY) < 20 && Math.abs(target.x - sp.x) < 250 * progress; }
          else if (sp.type === 'lightningStorm') { inRange = Math.abs(target.x - sp.targetX) < 100; }
          else if (sp.type === 'bloodFrenzy') { inRange = false; } // self-buff only
          else if (sp.type === 'boulderThrow') { inRange = Math.abs(target.x - sp.x) < 50 && Math.abs(target.y - 60 - sp.y) < 50; }
          else { // cone/directional attacks
            const reach = sp.facing > 0 ? (target.x > sp.x && target.x < sp.x + 250) : (target.x < sp.x && target.x > sp.x - 250);
            inRange = reach && Math.abs(target.y - 60 - sp.y) < 80;
          }
          if (inRange) {
            const dmg = sp.type === 'boulderThrow' ? 12 : sp.type === 'earthquake' ? 5 : sp.type === 'lightningStorm' ? 7 : 4;
            target.hp = Math.max(0, target.hp - dmg);
            target.vx += sp.facing * 2; target.hitDir = v(sp.facing, -0.2); target.hitImpact = 5;
            spawnBlood(target.x, target.y - 50, sp.facing, 8, 2);
            if (target.hp <= 0) {
              const attacker = g.fighters[sp.owner];
              ss(target, 'ko'); startRagdoll(target, v(sp.facing * 20, -10), 999);
              attacker.wins++; g.rs = 'ko'; g.koTimer = 340; g.slowMo = 0.05; g.slowTimer = 55; g.flash = 15; g.flashColor = charDef.specialColor;
              spawnBlood(target.x, target.y - 50, sp.facing, 100, 6); spawnGore(target.x, target.y - 50, 15, sp.facing);
              playSFX('ko', sfxVolume);
              if (ttsEnabled) { speakAnnouncer(pick(KO_ANNOUNCER_LINES)); setTimeout(() => speakFighterLine(charDef.koWinnerLines.length ? charDef.koWinnerLines : KO_WINNER_LINES, sp.owner), 2000); }
            }
          }
        }

        // Update particles
        sp.particles = sp.particles.filter(fp => { fp.x += fp.vx * spd; fp.y += fp.vy * spd; fp.vy += 0.1 * spd; fp.life -= spd; return fp.life > 0; });
        return sp.life > 0;
      });

      // Bullets
      g.bullets = g.bullets.filter(b => {
        b.x += b.vx * spd; b.y += b.vy * spd; b.vy += 0.05 * spd;
        b.trail.push({ x: b.x, y: b.y }); if (b.trail.length > 8) b.trail.shift(); b.life -= spd;
        const target = g.fighters[1 - b.owner];
        if (target.state !== 'ko' && target.state !== 'dodge') {
          if (target.state === 'block' && target.shieldHP > 0) {
            const shieldPos = target.rag.pts[7].pos;
            if (vlen(vsub(v(b.x, b.y), shieldPos)) < 30) {
              target.shieldHP -= 5; spawnSparks(b.x, b.y, 10); spawnRing(b.x, b.y, 20, '#aa8'); playSFX('block', sfxVolume); return false;
            }
          }
          for (let i = 0; i < target.rag.pts.length; i++) {
            if (vlen(vsub(v(b.x, b.y), target.rag.pts[i].pos)) < 25) {
              const hitDir = vnorm(v(b.vx, b.vy));
              target.hp = Math.max(0, target.hp - b.dmg); target.vx += hitDir.x * 4; target.hitDir = hitDir; target.hitImpact = b.dmg * 0.5;
              if (i === 0) target.headHits += 2;
              spawnBlood(b.x, b.y, hitDir.x > 0 ? 1 : -1, 25, 3); spawnSparks(b.x, b.y, 8); spawnRing(b.x, b.y, 30, '#fa0');
              playSFX('hit', sfxVolume);
              if (b.dmg >= 10) ss(target, 'hit', 12);
              if (target.hp <= 0) {
                const shooter = g.fighters[b.owner]; ss(target, 'ko'); startRagdoll(target, vscl(hitDir, 18), 999); shooter.wins++; g.rs = 'ko'; g.koTimer = 340; g.slowMo = 0.05; g.slowTimer = 55; g.flash = 15; g.flashColor = '#fff'; spawnBlood(b.x, b.y, hitDir.x > 0 ? 1 : -1, 80, 6); spawnGore(b.x, b.y, 10, hitDir.x > 0 ? 1 : -1); spawnRing(b.x, b.y, 100, '#f00');
                playSFX('ko', sfxVolume);
                if (ttsEnabled) { speakAnnouncer(pick(KO_ANNOUNCER_LINES)); setTimeout(() => speakFighterLine(KO_LOSER_LINES, 1 - b.owner), 2000); setTimeout(() => speakFighterLine(KO_WINNER_LINES, b.owner), 4000); }
              }
              return false;
            }
          }
        }
        if (b.y > GY || b.x < 10 || b.x > WORLD_W - 10) { spawnSparks(b.x, Math.min(b.y, GY), 5); return false; }
        return b.life > 0;
      });

      // Melee hit detection
      g.fighters.forEach((f, idx) => {
        const o = g.fighters[1 - idx];
        const atkName = f.state === 'limbSmash' ? 'limbSmash' : f.state;
        const ad = ATK[atkName]; if (!ad || f.hitDealt) return;
        if (f.state === 'dodge' || f.state === 'shoot') return;
        const hs = Math.round(ad.hitStart / f.weapon.speed);
        const he = Math.round(ad.hitEnd / f.weapon.speed);
        if (f.frame < hs || f.frame > he) return;

        let tipX: number, tipY: number;
        const isKickAtk = ad.isKick || ['kick', 'headKick', 'kneeStrike', 'roundhouse', 'divekick', 'backflipKick', 'wallFlip'].includes(f.state);
        const isHeadbutt = ad.isHeadbutt || f.state === 'headbutt';
        const isPunch = ad.isPunch || f.state === 'punch';
        if (f.state === 'limbSmash' && f.heldLimb) {
          const lhand = f.rag.pts[7].pos; tipX = lhand.x + Math.cos(f.limbSwingAng * f.facing) * 45; tipY = lhand.y + Math.sin(f.limbSwingAng * f.facing) * 45;
        } else if (isHeadbutt) {
          tipX = f.rag.pts[0].pos.x + f.facing * 15; tipY = f.rag.pts[0].pos.y;
        } else if (isPunch) {
          tipX = f.rag.pts[10].pos.x + f.facing * 10; tipY = f.rag.pts[10].pos.y;
        } else if (isKickAtk) {
          tipX = f.rag.pts[16].pos.x; tipY = f.rag.pts[16].pos.y;
          if (f.state === 'headKick') { tipY = Math.min(tipY, f.y - 100); }
          if (f.state === 'kneeStrike') { tipX = f.rag.pts[15].pos.x; tipY = f.rag.pts[15].pos.y; }
        } else if (!f.hasSword) {
          tipX = f.rag.pts[10].pos.x + f.facing * 10; tipY = f.rag.pts[10].pos.y;
        } else {
          const hand = f.rag.pts[10].pos; const ang = f.wAngle * f.facing;
          tipX = hand.x + Math.cos(ang) * f.weapon.len * 0.8; tipY = hand.y + Math.sin(ang) * f.weapon.len * 0.8;
        }

        if (o.state === 'dodge') return;

        // Shield block
        if (o.state === 'block' && o.shieldHP > 0 && !isKickAtk) {
          const shieldPos = o.rag.pts[7].pos;
          if (vlen(vsub(v(tipX, tipY), shieldPos)) < 35) {
            f.hitDealt = true;
            o.shieldHP -= f.weapon[ad.dmgKey] * 0.5;
            o.vx = f.facing * ad.kb.x * 0.2;
            spawnSparks((f.x + o.x) / 2, shieldPos.y, 18);
            spawnRing((f.x + o.x) / 2, shieldPos.y, 40, '#aa8');
            playSFX('block', sfxVolume);
            if (o.shieldHP <= 0) { spawnSparks(shieldPos.x, shieldPos.y, 30); spawnRing(shieldPos.x, shieldPos.y, 60, '#f80'); g.flash = 5; g.flashColor = '#fa0'; }
            return;
          }
        }

        let hitPt: V | null = null; let hitJoint = -1;
        for (let i = 0; i < o.rag.pts.length; i++) {
          const dd = vlen(vsub(v(tipX, tipY), o.rag.pts[i].pos));
          if (dd < 38) { hitPt = o.rag.pts[i].pos; hitJoint = i; break; }
        }
        if (!hitPt) {
          if (Math.abs(tipX - o.x) < 55 && Math.abs(tipY - (o.y - 55)) < 65) { hitPt = v(o.x, o.y - 55); hitJoint = 2; }
        }

        if (hitPt) {
          f.hitDealt = true;
          let dmg = f.weapon[ad.dmgKey];

          if (isKickAtk && (hitJoint === 0 || hitJoint === 1)) {
            o.headHits++;
            dmg *= 1.2;
            if (o.headHits >= 8 && !o.severed.has('head')) { sever(o, 'head', f.facing); }
          }
          if (isHeadbutt) { dmg *= 1.3; o.headHits++; }

          // Fatality special hits
          if (f.state === 'fatality') {
            const subAp = f.dur > 0 ? (f.frame / f.dur * 4) % 1 : 0;
            dmg *= 3;
            spawnBlood(hitPt.x, hitPt.y, f.facing, 50, 5);
            spawnGore(hitPt.x, hitPt.y, 8, f.facing);
            if (subAp < 0.1) { spawnRing(hitPt.x, hitPt.y, 80, '#f00'); spawnLightning(hitPt.x, hitPt.y - 40, hitPt.x + rng(-50, 50), hitPt.y + 30); }
            g.flash = Math.max(g.flash, 3); g.flashColor = '#a00';
            if (f.frame > f.dur * 0.7) {
              ['leftArm', 'rightArm', 'leftLeg', 'rightLeg', 'head'].forEach(part => { if (!o.severed.has(part) && rng(0, 1) < 0.5) sever(o, part, f.facing); });
            }
          }

          if (f.state === 'limbSmash' && f.heldLimb) { dmg *= 1.5; spawnBlood(hitPt.x, hitPt.y, f.facing, 60, 5); spawnGore(hitPt.x, hitPt.y, 10, f.facing); spawnRing(hitPt.x, hitPt.y, 100, '#f40'); spawnLightning(f.rag.pts[7].pos.x, f.rag.pts[7].pos.y, hitPt.x, hitPt.y); f.heldLimb = null; g.flash = 6; g.flashColor = '#ff4'; playSFX('heavyHit', sfxVolume); }
          if (f.state === 'execution') { dmg *= 2.5; spawnBlood(hitPt.x, hitPt.y, f.facing, 80, 6); spawnGore(hitPt.x, hitPt.y, 15, f.facing); spawnRing(hitPt.x, hitPt.y, 120, '#f00'); g.flash = 10; g.flashColor = '#a00'; g.slowMo = 0.15; g.slowTimer = 25; playSFX('heavyHit', sfxVolume); }
          if (f.state === 'backflipKick') { dmg *= 1.3; spawnRing(hitPt.x, hitPt.y, 80, '#ff8'); g.slowMo = 0.3; g.slowTimer = 12; }
          if (f.state === 'wallFlip') { dmg *= 1.8; spawnRing(hitPt.x, hitPt.y, 90, '#8ff'); g.slowMo = 0.2; g.slowTimer = 18; g.flash = 6; g.flashColor = '#8af'; }
          if (f.state === 'divekick') { dmg *= 1.6; spawnRing(hitPt.x, hitPt.y, 70, '#fa0'); g.slowMo = 0.25; g.slowTimer = 15; g.flash = 5; g.flashColor = '#fa0'; }
          if (f.state === 'roundhouse') { dmg *= 1.4; spawnRing(hitPt.x, hitPt.y, 60, '#f80'); g.slowMo = 0.3; g.slowTimer = 10; }
          if (f.state === 'headbutt') { dmg *= 1.3; spawnRing(hitPt.x, hitPt.y, 50, '#ff0'); g.slowMo = 0.4; g.slowTimer = 8; o.headHits++; playSFX('headbutt', sfxVolume); }
          if (f.state === 'punch' && !f.hasSword) { dmg *= 0.7; }

          // Play appropriate SFX
          if (isKickAtk) playSFX('kick', sfxVolume);
          else if (isHeadbutt) playSFX('headbutt', sfxVolume);
          else if (isPunch) playSFX('hit', sfxVolume * 0.8);
          else if (dmg >= 18) playSFX('heavyHit', sfxVolume);
          else playSFX(f.hasSword ? 'slash' : 'hit', sfxVolume);

          const hitDir2 = v(f.facing, -0.3);
          if (aiData[idx]) { aiData[idx].mem.lastAtkLanded = true; aiData[idx].mem.excitement += 2; }
          if (aiData[1 - idx]) { aiData[1 - idx].mem.timesHit++; aiData[1 - idx].mem.lastAtkLanded = false; }

          if (o.state === 'block' && o.stamina > 5 && o.shieldHP > 0) {
            o.vx = f.facing * ad.kb.x * 0.3; o.stamina -= dmg * 0.5; o.shieldHP -= dmg * 0.3;
            spawnSparks((f.x + o.x) / 2, hitPt.y, 15); spawnRing((f.x + o.x) / 2, hitPt.y, 50, '#ff8');
            playSFX('block', sfxVolume);
          } else {
            f.combo++; f.comboTimer = 80;
            let finalDmg = dmg * 0.55; if (f.combo > 1) finalDmg *= (1 + f.combo * 0.08);
            o.hp = Math.max(0, o.hp - finalDmg); o.vx = f.facing * ad.kb.x; o.vy = ad.kb.y;
            if (ad.kb.y < -4) o.grounded = false;
            o.hitDir = vnorm(hitDir2); o.hitImpact = dmg * 0.6;
            const impForce = dmg * 0.4;
            for (let i = 0; i < o.rag.pts.length; i++) { const dd = vlen(vsub(o.rag.pts[i].pos, hitPt)); if (dd < 90) { o.rag.pts[i].old = vsub(o.rag.pts[i].pos, vscl(hitDir2, impForce * (1 - dd / 90))); } }
            if (dmg >= 18) { startRagdoll(o, vscl(hitDir2, dmg * 0.5), 35 + dmg); spawnRing(hitPt.x, hitPt.y, 70, '#a00'); }
            else ss(o, dmg >= 13 ? 'stagger' : 'hit', dmg >= 13 ? 25 : 14);
            spawnBlood(hitPt.x, hitPt.y, f.facing, Math.round(dmg * 2.5), dmg / 6);
            if (hitJoint >= 0 && hitJoint < o.rag.pts.length) spawnBlood(o.rag.pts[hitJoint].pos.x, o.rag.pts[hitJoint].pos.y, f.facing, 18, 3);
            if (dmg >= 15) spawnGore(hitPt.x, hitPt.y, Math.round(dmg / 4), f.facing);
            // Dismemberment
            if (o.hp < 100 && rng(0, 1) < 0.35) {
              const parts = ['leftArm', 'rightArm'].filter(p3 => !o.severed.has(p3));
              if (o.hp < 60) parts.push(...['leftLeg', 'rightLeg'].filter(p3 => !o.severed.has(p3)));
              if (o.hp < 25) parts.push('head');
              if (parts.length > 0) { sever(o, pick(parts), f.facing); if (rng(0, 1) < 0.4) { const rem = ['leftArm', 'rightArm', 'leftLeg', 'rightLeg'].filter(p3 => !o.severed.has(p3)); if (rem.length > 0) sever(o, pick(rem), f.facing); } }
            }
            if (o.hp <= 0) {
              ss(o, 'ko'); startRagdoll(o, vscl(hitDir2, 22), 999);
              f.wins++; g.rs = 'ko'; g.koTimer = 340; g.slowMo = 0.05; g.slowTimer = 55; g.flash = 15; g.flashColor = '#fff';
              spawnBlood(hitPt.x, hitPt.y, f.facing, 120, 7); spawnGore(hitPt.x, hitPt.y, 20, f.facing);
              spawnRing(hitPt.x, hitPt.y, 150, '#f00'); spawnRing(hitPt.x, hitPt.y, 200, '#a00');
              spawnLightning(hitPt.x, hitPt.y, hitPt.x + rng(-100, 100), hitPt.y - rng(50, 150));
              if (!o.severed.has('head')) sever(o, 'head', f.facing);
              const lp = ['leftArm', 'rightArm', 'leftLeg', 'rightLeg'].filter(p3 => !o.severed.has(p3));
              if (lp.length > 0) sever(o, pick(lp), f.facing);
              playSFX('ko', sfxVolume);
              if (ttsEnabled) { speakAnnouncer(pick(KO_ANNOUNCER_LINES)); setTimeout(() => speakFighterLine(KO_LOSER_LINES, 1 - idx), 2000); setTimeout(() => speakFighterLine(KO_WINNER_LINES, idx), 4000); }
            }
          }
        }
      });

      // Particles
      g.blood = g.blood.filter(b => { if (b.grounded) { b.life -= spd * 0.15; return b.life > 0; } b.x += b.vx * spd; b.y += b.vy * spd; b.vy += 0.35 * spd; b.vx *= 0.99; b.life -= spd; if (b.y >= GY) { b.grounded = true; b.y = GY; b.vy = 0; b.vx = 0; if (g.pools.length < 180) { const ex = g.pools.find(p3 => Math.abs(p3.x - b.x) < 25); if (ex) ex.r = Math.min(55, ex.r + 1.5); else g.pools.push({ x: b.x, y: GY, r: 3 + rng(0, 7), a: 0.85 }); } } return b.life > 0; });
      g.sparks = g.sparks.filter(s => { s.x += s.vx * spd; s.y += s.vy * spd; s.vy += 0.4 * spd; s.life -= spd; return s.life > 0; });
      g.gore = g.gore.filter(gc => { gc.x += gc.vx * spd; gc.y += gc.vy * spd; gc.vy += 0.3 * spd; gc.rot += gc.rotV * spd; if (gc.y >= GY) { gc.y = GY; gc.vy *= -0.3; gc.vx *= 0.6; } gc.life -= spd; return gc.life > 0; });
      g.limbs = g.limbs.filter(l => { if (l.grounded) { l.life -= spd * 0.3; return l.life > 0; } l.pts.forEach(p3 => { p3.x += l.vel.x * spd; p3.y += l.vel.y * spd; }); l.vel.y += 0.3 * spd; l.ang += l.angV * spd; if (l.pts[0] && l.pts[0].y >= GY) { l.vel.x *= 0.7; l.vel.y *= -0.2; l.pts[0].y = GY; if (Math.abs(l.vel.y) < 1) { l.grounded = true; l.vel = v(0, 0); } } l.life -= spd * 0.2; if (l.life > 100 && l.pts[0] && l.pts[0].y < GY && fc % 3 === 0) spawnBlood(l.pts[0].x, l.pts[0].y, rng(-1, 1), 3, 2); return l.life > 0; });
      g.pools.forEach(p3 => p3.a = Math.max(0.08, p3.a - 0.0002));
      g.afterimages = g.afterimages.filter(a => { a.alpha -= 0.03; return a.alpha > 0; });
      g.rings = g.rings.filter(r => { r.r += (r.maxR - r.r) * 0.15; r.life -= 0.06; return r.life > 0; });
      g.lightnings = g.lightnings.filter(l => { l.life -= 1; return l.life > 0; });
      g.muzzleFlashes = g.muzzleFlashes.filter(m => { m.life -= spd; return m.life > 0; });
      g.wallSparks = g.wallSparks.filter(ws => { ws.x += ws.vx * spd; ws.y += ws.vy * spd; ws.vy += 0.2 * spd; ws.life -= spd; return ws.life > 0; });
      g.fatalityTexts = g.fatalityTexts.filter(ft => { ft.life -= spd; return ft.life > 0; });

      // Thrown swords
      g.thrownSwords = g.thrownSwords.filter(ts => {
        if (ts.stuck) { ts.life -= spd; return ts.life > 0; }
        ts.x += ts.vx * spd; ts.y += ts.vy * spd; ts.vy += 0.2 * spd; ts.ang += ts.angV * spd; ts.life -= spd;
        const target = g.fighters[1 - ts.owner];
        if (target.state !== 'ko' && target.state !== 'dodge') {
          for (let i = 0; i < target.rag.pts.length; i++) {
            if (vlen(vsub(v(ts.x, ts.y), target.rag.pts[i].pos)) < 30) {
              target.hp = Math.max(0, target.hp - ts.dmg);
              const hd = vnorm(v(ts.vx, ts.vy));
              target.vx += hd.x * 8; target.hitDir = hd; target.hitImpact = ts.dmg * 0.5;
              spawnBlood(ts.x, ts.y, hd.x > 0 ? 1 : -1, 40, 4);
              spawnSparks(ts.x, ts.y, 12); spawnRing(ts.x, ts.y, 50, '#fa0');
              if (i === 0) target.headHits += 2;
              ss(target, ts.dmg >= 20 ? 'stagger' : 'hit', ts.dmg >= 20 ? 25 : 14);
              playSFX('heavyHit', sfxVolume);
              if (target.hp <= 0) {
                ss(target, 'ko'); startRagdoll(target, vscl(hd, 20), 999);
                g.fighters[ts.owner].wins++; g.rs = 'ko'; g.koTimer = 340;
                g.slowMo = 0.05; g.slowTimer = 40; g.flash = 12; g.flashColor = '#fff';
                playSFX('ko', sfxVolume);
                if (ttsEnabled) { speakAnnouncer(pick(KO_ANNOUNCER_LINES)); setTimeout(() => speakFighterLine(KO_LOSER_LINES, 1 - ts.owner), 2000); }
              }
              ts.stuck = true; ts.vx = 0; ts.vy = 0; ts.life = 60;
              return true;
            }
          }
        }
        if (ts.y > GY) { ts.stuck = true; ts.y = GY; ts.life = 120; spawnSparks(ts.x, ts.y, 6); }
        if (ts.x < 10 || ts.x > WORLD_W - 10) { ts.stuck = true; ts.life = 60; spawnSparks(ts.x, ts.y, 8); }
        return ts.life > 0;
      });

      if (fc % 3 === 0) setHud({ p1hp: p1.hp, p2hp: p2.hp, timer: Math.ceil(g.timer / 60), round: g.round, p1st: p1.stamina, p2st: p2.stamina, p1w: p1.wins, p2w: p2.wins, rs: g.rs, n1: p1.name, n2: p2.name, w1: p1.weapon.name, w2: p2.weapon.name, p1limb: !!p1.heldLimb, p2limb: !!p2.heldLimb });
    };

    // ── RENDER ──
    const render = () => {
      tick(); ctx.save();

      const p1 = g.fighters[0], p2 = g.fighters[1];
      const targetCamX = clamp((p1.x + p2.x) / 2, W / 2, WORLD_W - W / 2);
      g.camX += (targetCamX - g.camX) * 0.06;
      const camX = g.camX - W / 2;

      // ── SKY ──
      const sky = ctx.createLinearGradient(0, 0, 0, GY);
      sky.addColorStop(0, '#020108'); sky.addColorStop(0.2, '#060318'); sky.addColorStop(0.4, '#0a0520'); sky.addColorStop(0.6, '#10082a'); sky.addColorStop(1, '#141430');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, GY);

      // ── STARS ──
      for (let i = 0; i < 200; i++) {
        const sx2 = ((i * 197 + 53) * 7.3) % W;
        const sy2 = ((i * 131 + 17) * 3.7) % (GY * 0.65);
        const tw = 0.15 + Math.sin(g.bgTime * (0.3 + (i % 7) * 0.15) + i * 2.1) * 0.25 + Math.sin(g.bgTime * 1.7 + i * 0.8) * 0.1;
        if (tw < 0.05) continue;
        const hue = 200 + (i * 37) % 60;
        const sat = 10 + (i % 30);
        ctx.fillStyle = `hsla(${hue},${sat}%,${85 + (i % 15)}%,${tw})`;
        const sz = 0.4 + (i % 5) * 0.25;
        ctx.beginPath(); ctx.arc(sx2, sy2, sz, 0, Math.PI * 2); ctx.fill();
        if (sz > 1 && tw > 0.3) {
          ctx.strokeStyle = `hsla(${hue},${sat}%,90%,${tw * 0.3})`;
          ctx.lineWidth = 0.5;
          ctx.beginPath(); ctx.moveTo(sx2 - 3, sy2); ctx.lineTo(sx2 + 3, sy2); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(sx2, sy2 - 3); ctx.lineTo(sx2, sy2 + 3); ctx.stroke();
        }
      }

      // ── MOON ──
      const moonX = 180 - camX * 0.02, moonY = 100;
      const moonGlow = ctx.createRadialGradient(moonX, moonY, 20, moonX, moonY, 120);
      moonGlow.addColorStop(0, 'rgba(200,180,140,0.15)'); moonGlow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = moonGlow; ctx.fillRect(moonX - 120, moonY - 120, 240, 240);
      ctx.fillStyle = 'rgba(220,210,180,0.12)'; ctx.beginPath(); ctx.arc(moonX, moonY, 55, 0, Math.PI * 2); ctx.fill();

      // ── CLOUDS ──
      g.clouds.forEach(c => { c.x += c.speed; if (c.x > WORLD_W + 200) c.x = -c.w;
        const sx = c.x - camX * 0.15;
        if (sx > -c.w && sx < W + c.w) { ctx.fillStyle = `rgba(40,30,60,${c.opacity})`; ctx.beginPath(); ctx.ellipse(sx, c.y, c.w, c.w * 0.25, 0, 0, Math.PI * 2); ctx.fill(); }
      });

      // ── FAR MOUNTAINS ──
      ctx.fillStyle = '#070512'; ctx.beginPath(); ctx.moveTo(0, GY);
      for (const m of g.farMountains) { const sx = m.x - camX * 0.2; if (sx > -100 && sx < W + 100) ctx.lineTo(sx, GY - m.h); }
      ctx.lineTo(W, GY); ctx.fill();

      // ── NEAR MOUNTAINS ──
      ctx.fillStyle = '#0a0818'; ctx.beginPath(); ctx.moveTo(0, GY);
      for (const m of g.nearMountains) { const sx = m.x - camX * 0.4; if (sx > -100 && sx < W + 100) ctx.lineTo(sx, GY - m.h); }
      ctx.lineTo(W, GY); ctx.fill();

      // ── SCENERY ──
      const drawSceneryItem = (item: { type: string; x: number; scale: number; flip: boolean }) => {
        const sx = item.x - camX * 0.7;
        if (sx < -150 || sx > W + 150) return;
        const s = item.scale;
        ctx.save();
        ctx.translate(sx, GY);
        if (item.flip) ctx.scale(-1, 1);
        ctx.scale(s, s);

        switch (item.type) {
          case 'deadTree': {
            ctx.strokeStyle = '#1a1210'; ctx.lineWidth = 5; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-3, -60); ctx.lineTo(5, -90); ctx.stroke();
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(-3, -60); ctx.lineTo(-25, -75); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(2, -70); ctx.lineTo(22, -85); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(5, -90); ctx.lineTo(-8, -100); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(5, -90); ctx.lineTo(15, -105); ctx.stroke();
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(-25, -75); ctx.lineTo(-35, -70); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(22, -85); ctx.lineTo(30, -95); ctx.stroke();
            break;
          }
          case 'grave': {
            ctx.fillStyle = '#15121a';
            ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-8, -18); ctx.quadraticCurveTo(-8, -25, 0, -25); ctx.quadraticCurveTo(8, -25, 8, -18); ctx.lineTo(8, 0); ctx.fill();
            ctx.strokeStyle = '#20181a'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(0, -12); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(-4, -18); ctx.lineTo(4, -18); ctx.stroke();
            break;
          }
          case 'pillar': {
            ctx.fillStyle = '#12101a'; ctx.fillRect(-6, -70, 12, 70); ctx.fillRect(-10, -75, 20, 8);
            ctx.strokeStyle = '#0a0812'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(-2, -50); ctx.lineTo(3, -30); ctx.lineTo(-1, -10); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(-10, -75); ctx.lineTo(-6, -82); ctx.lineTo(0, -78); ctx.lineTo(6, -85); ctx.lineTo(10, -75); ctx.fill();
            break;
          }
          case 'stone': {
            ctx.fillStyle = '#14121a';
            ctx.beginPath(); ctx.moveTo(-15, 0); ctx.lineTo(-12, -20); ctx.lineTo(-3, -30); ctx.lineTo(8, -28); ctx.lineTo(14, -15); ctx.lineTo(15, 0); ctx.fill();
            ctx.fillStyle = '#0a1208'; ctx.fillRect(-8, -5, 10, 5);
            break;
          }
          case 'fence': {
            ctx.strokeStyle = '#1a1510'; ctx.lineWidth = 2; ctx.lineCap = 'round';
            for (let i = 0; i < 4; i++) { const fx = -20 + i * 13; ctx.beginPath(); ctx.moveTo(fx, 0); ctx.lineTo(fx, -25 - (i % 2) * 5); ctx.stroke(); }
            ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(-20, -12); ctx.lineTo(19, -12); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(-20, -20); ctx.lineTo(19, -20); ctx.stroke();
            break;
          }
          case 'skull': {
            ctx.strokeStyle = '#1a1510'; ctx.lineWidth = 3; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -50); ctx.stroke();
            ctx.fillStyle = '#d8d0b8'; ctx.beginPath(); ctx.arc(0, -58, 8, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(-3, -59, 2, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(3, -59, 2, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.moveTo(-2, -54); ctx.lineTo(2, -54); ctx.stroke();
            break;
          }
          case 'castle': {
            ctx.fillStyle = '#08061a';
            ctx.fillRect(-40, -220, 80, 220); ctx.fillRect(-55, -260, 25, 260); ctx.fillRect(30, -240, 25, 240);
            for (let bx = -55; bx < 55; bx += 12) ctx.fillRect(bx, -230, 8, 12);
            ctx.beginPath(); ctx.moveTo(-60, -260); ctx.lineTo(-42, -310); ctx.lineTo(-25, -260); ctx.fill();
            ctx.beginPath(); ctx.moveTo(25, -240); ctx.lineTo(42, -285); ctx.lineTo(60, -240); ctx.fill();
            const castleWindows = [[-20, -180], [10, -180], [-20, -130], [10, -130], [-45, -230], [38, -210]];
            castleWindows.forEach(([cwx, cwy]) => {
              const flicker = 0.6 + Math.sin(g.bgTime * 2.5 + (cwx + item.x) * 0.13) * 0.2 + Math.sin(g.bgTime * 4.3 + cwx * 0.07) * 0.1;
              const glow2 = ctx.createRadialGradient(cwx + 5, cwy + 8, 1, cwx + 5, cwy + 8, 35);
              glow2.addColorStop(0, `rgba(255,160,50,${flicker * 0.2})`); glow2.addColorStop(1, 'rgba(255,60,10,0)');
              ctx.fillStyle = glow2; ctx.fillRect(cwx - 30, cwy - 25, 70, 70);
              ctx.fillStyle = `rgba(255,180,80,${flicker * 0.7})`; ctx.fillRect(cwx, cwy, 10, 16);
              ctx.fillStyle = `rgba(255,220,140,${flicker * 0.5})`; ctx.fillRect(cwx + 2, cwy + 2, 6, 12);
              ctx.strokeStyle = 'rgba(30,20,10,0.6)'; ctx.lineWidth = 1; ctx.strokeRect(cwx, cwy, 10, 16);
            });
            break;
          }
        }
        ctx.restore();
      };
      g.scenery.forEach(drawSceneryItem);

      // ── WORLD-SPACE ──
      ctx.save();
      ctx.translate(-camX, 0);

      // Ground
      const gnd = ctx.createLinearGradient(0, GY - 3, 0, H); gnd.addColorStop(0, '#1a1008'); gnd.addColorStop(1, '#0a0604');
      ctx.fillStyle = gnd; ctx.fillRect(camX - 10, GY - 3, W + 20, H - GY + 3);
      ctx.strokeStyle = '#3a2a15'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(camX - 10, GY); ctx.lineTo(camX + W + 10, GY); ctx.stroke();
      ctx.fillStyle = `rgba(20,15,40,${0.08 + Math.sin(g.bgTime * 0.3) * 0.03})`; ctx.fillRect(camX - 10, GY - 50, W + 20, 60);

      // Blood pools
      g.pools.forEach(p3 => { if (p3.x < camX - 60 || p3.x > camX + W + 60) return; ctx.fillStyle = `rgba(130,0,0,${p3.a})`; ctx.beginPath(); ctx.ellipse(p3.x, p3.y + 2, p3.r, p3.r * 0.3, 0, 0, Math.PI * 2); ctx.fill(); });
      // Afterimages
      g.afterimages.forEach(ai2 => { ctx.globalAlpha = ai2.alpha * 0.4; ctx.strokeStyle = ai2.color; ctx.lineWidth = 3; ctx.lineCap = 'round';
        const db = (a: number, b: number) => { if (ai2.pts[a] && ai2.pts[b]) { ctx.beginPath(); ctx.moveTo(ai2.pts[a].x, ai2.pts[a].y); ctx.lineTo(ai2.pts[b].x, ai2.pts[b].y); ctx.stroke(); } };
        db(0, 1); db(1, 2); db(2, 3); db(3, 4); db(5, 6); db(6, 7); db(8, 9); db(9, 10); db(11, 12); db(12, 13); db(14, 15); db(15, 16);
      }); ctx.globalAlpha = 1;
      // Limbs
      g.limbs.forEach(l => { if (!l.pts.length) return; ctx.save(); ctx.translate(l.pts[0].x, l.pts[0].y); ctx.rotate(l.ang);
        if (l.isHead) { ctx.fillStyle = l.color; ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#800'; ctx.beginPath(); ctx.arc(0, 12, 5, 0, Math.PI * 2); ctx.fill(); }
        else { ctx.strokeStyle = l.color; ctx.lineWidth = l.w; ctx.lineCap = 'round'; for (let i = 1; i < l.pts.length; i++) { const d = vsub(l.pts[i], l.pts[0]); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(d.x, d.y); ctx.stroke(); } ctx.fillStyle = '#800'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill(); }
        if (l.grounded) { ctx.strokeStyle = `rgba(255,255,100,${0.1 + Math.sin(g.bgTime * 4) * 0.08})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.stroke(); }
        ctx.restore();
      });
      // Gore
      g.gore.forEach(gc => { ctx.save(); ctx.translate(gc.x, gc.y); ctx.rotate(gc.rot); ctx.fillStyle = gc.color; ctx.fillRect(-gc.sz / 2, -gc.sz / 2, gc.sz, gc.sz); ctx.restore(); });
      // Fighters
      g.fighters.forEach(f => drawFighter(ctx, f, fc));
      // Thrown swords
      g.thrownSwords.forEach(ts => {
        ctx.save(); ctx.translate(ts.x, ts.y); ctx.rotate(ts.ang);
        ctx.strokeStyle = ts.weapon.blade; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-ts.weapon.len * 0.3, 0); ctx.lineTo(ts.weapon.len * 0.3, 0); ctx.stroke();
        ctx.strokeStyle = ts.weapon.color; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(-ts.weapon.len * 0.3, 0); ctx.lineTo(-ts.weapon.len * 0.3 - 12, 0); ctx.stroke();
        if (!ts.stuck) { ctx.strokeStyle = 'rgba(255,200,100,0.3)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-ts.weapon.len * 0.4, 0); ctx.lineTo(-ts.weapon.len * 0.4 - 20, 0); ctx.stroke(); }
        ctx.restore();
      });
      // Bullets
      g.bullets.forEach(b => { if (b.trail.length > 1) { for (let i = 1; i < b.trail.length; i++) { const a = i / b.trail.length; ctx.strokeStyle = `rgba(255,200,50,${a * 0.5})`; ctx.lineWidth = 2 * a; ctx.beginPath(); ctx.moveTo(b.trail[i - 1].x, b.trail[i - 1].y); ctx.lineTo(b.trail[i].x, b.trail[i].y); ctx.stroke(); } } ctx.fillStyle = '#ff8'; ctx.beginPath(); ctx.arc(b.x, b.y, 2.5, 0, Math.PI * 2); ctx.fill(); });
      // Muzzle flashes
      g.muzzleFlashes.forEach(m => { const mfSize = m.life * 8; const mfGrad = ctx.createRadialGradient(m.x, m.y, 1, m.x, m.y, mfSize); mfGrad.addColorStop(0, `rgba(255,255,200,${m.life / 4 * 0.8})`); mfGrad.addColorStop(1, 'rgba(255,100,0,0)'); ctx.fillStyle = mfGrad; ctx.beginPath(); ctx.arc(m.x, m.y, mfSize, 0, Math.PI * 2); ctx.fill(); });
      // Wall sparks
      g.wallSparks.forEach(ws => { ctx.fillStyle = `rgba(255,200,100,${ws.life / 18})`; ctx.beginPath(); ctx.arc(ws.x, ws.y, 1.5, 0, Math.PI * 2); ctx.fill(); });
      // Blood
      g.blood.forEach(b => { if (b.grounded) { ctx.fillStyle = `rgba(160,0,0,${(b.life / b.maxLife) * 0.5})`; ctx.beginPath(); ctx.ellipse(b.x, b.y + 1, b.sz * 1.3, b.sz * 0.4, 0, 0, Math.PI * 2); ctx.fill(); } else { const a = b.life / b.maxLife; ctx.fillStyle = `rgba(210,10,10,${a * 0.9})`; ctx.beginPath(); ctx.arc(b.x, b.y, b.sz * (0.6 + a * 0.4), 0, Math.PI * 2); ctx.fill(); } });
      // Sparks
      g.sparks.forEach(s => { ctx.globalAlpha = s.life / 20; ctx.fillStyle = s.color; ctx.beginPath(); ctx.arc(s.x, s.y, s.sz * (s.life / 20), 0, Math.PI * 2); ctx.fill(); }); ctx.globalAlpha = 1;
      // Rings
      g.rings.forEach(ring => { ctx.strokeStyle = ring.color; ctx.globalAlpha = ring.life * 0.6; ctx.lineWidth = 3 * ring.life; ctx.beginPath(); ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2); ctx.stroke(); }); ctx.globalAlpha = 1;
      // Lightning
      g.lightnings.forEach(l => { ctx.globalAlpha = l.life / 8; l.branches.forEach(branch => { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 + l.life * 0.3; ctx.beginPath(); branch.forEach((p4, i) => { if (i === 0) ctx.moveTo(p4.x, p4.y); else ctx.lineTo(p4.x, p4.y); }); ctx.stroke(); }); }); ctx.globalAlpha = 1;

      // ── SKULL FIRE SPECIAL ──
      g.specials.filter(s => s.type === 'skullFire').forEach(sk => {
        const progress = 1 - sk.life / sk.maxLife;
        const phase = progress < 0.15 ? 'rise' : progress < 0.85 ? 'breathe' : 'fade';
        const alpha = phase === 'fade' ? (sk.life / (sk.maxLife * 0.15)) : 1;
        ctx.save(); ctx.globalAlpha = alpha;
        // Giant skull
        const skullSize = phase === 'rise' ? 30 + progress * 40 : 70;
        const bobY = Math.sin(progress * 8) * 5;
        ctx.translate(sk.x, sk.y + bobY);
        // Skull glow
        const skGlow = ctx.createRadialGradient(0, 0, 10, 0, 0, skullSize * 1.8);
        skGlow.addColorStop(0, 'rgba(255,120,0,0.4)'); skGlow.addColorStop(0.5, 'rgba(255,60,0,0.15)'); skGlow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = skGlow; ctx.beginPath(); ctx.arc(0, 0, skullSize * 1.8, 0, Math.PI * 2); ctx.fill();
        // Skull shape
        ctx.fillStyle = '#e8d8b0'; ctx.beginPath(); ctx.arc(0, -5, skullSize * 0.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#d0c0a0'; ctx.beginPath(); ctx.ellipse(0, skullSize * 0.2, skullSize * 0.3, skullSize * 0.25, 0, 0, Math.PI * 2); ctx.fill();
        // Eye sockets - glowing
        const eyeGlow = ctx.createRadialGradient(-skullSize * 0.15, -skullSize * 0.08, 1, -skullSize * 0.15, -skullSize * 0.08, skullSize * 0.15);
        eyeGlow.addColorStop(0, '#ff4400'); eyeGlow.addColorStop(0.5, '#ff2200'); eyeGlow.addColorStop(1, '#440000');
        ctx.fillStyle = eyeGlow; ctx.beginPath(); ctx.ellipse(-skullSize * 0.15, -skullSize * 0.08, skullSize * 0.1, skullSize * 0.12, 0, 0, Math.PI * 2); ctx.fill();
        const eyeGlow2 = ctx.createRadialGradient(skullSize * 0.15, -skullSize * 0.08, 1, skullSize * 0.15, -skullSize * 0.08, skullSize * 0.15);
        eyeGlow2.addColorStop(0, '#ff4400'); eyeGlow2.addColorStop(0.5, '#ff2200'); eyeGlow2.addColorStop(1, '#440000');
        ctx.fillStyle = eyeGlow2; ctx.beginPath(); ctx.ellipse(skullSize * 0.15, -skullSize * 0.08, skullSize * 0.1, skullSize * 0.12, 0, 0, Math.PI * 2); ctx.fill();
        // Nose
        ctx.fillStyle = '#222'; ctx.beginPath(); ctx.moveTo(-4, skullSize * 0.08); ctx.lineTo(4, skullSize * 0.08); ctx.lineTo(0, skullSize * 0.18); ctx.closePath(); ctx.fill();
        // Teeth
        ctx.fillStyle = '#ddd';
        for (let t = -3; t <= 3; t++) { ctx.fillRect(t * skullSize * 0.06 - 2, skullSize * 0.25, 4, 8); }
        // Jaw opening for fire
        if (phase === 'breathe') {
          const jawOpen = 6 + Math.sin(progress * 12) * 3;
          ctx.fillStyle = '#ff3300'; ctx.beginPath(); ctx.ellipse(0, skullSize * 0.3 + jawOpen, skullSize * 0.2, jawOpen, 0, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
        // Fire stream particles
        if (phase === 'breathe') {
          sk.particles.forEach(fp => {
            const fpAlpha = fp.life / 35;
            const grad = ctx.createRadialGradient(fp.x, fp.y, 0, fp.x, fp.y, fp.sz * 2);
            grad.addColorStop(0, `rgba(255,220,50,${fpAlpha})`); grad.addColorStop(0.4, `rgba(255,100,0,${fpAlpha * 0.7})`); grad.addColorStop(1, `rgba(200,0,0,0)`);
            ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(fp.x, fp.y, fp.sz * 2, 0, Math.PI * 2); ctx.fill();
          });
        }
        ctx.globalAlpha = 1;
      });

      // ── DRAGON SPECIAL ──
      g.specials.filter(s => s.type === 'dragonStrike').forEach(dr => {
        const progress = 1 - dr.life / dr.maxLife;
        const alpha = progress > 0.7 ? Math.max(0, dr.life / (dr.maxLife * 0.3)) : 1;
        // Trail from particles
        dr.particles.forEach(t => {
          const tAlpha = t.life / 20;
          if (tAlpha > 0) {
            ctx.fillStyle = `rgba(0,150,255,${tAlpha * 0.3})`;
            ctx.beginPath(); ctx.arc(t.x, t.y, 8, 0, Math.PI * 2); ctx.fill();
          }
        });
        ctx.save(); ctx.globalAlpha = alpha;
        ctx.translate(dr.x, dr.y);
        ctx.scale(dr.facing, 1);
        // Dragon glow
        const drGlow = ctx.createRadialGradient(0, 0, 10, 0, 0, 80);
        drGlow.addColorStop(0, 'rgba(0,150,255,0.3)'); drGlow.addColorStop(0.5, 'rgba(0,80,200,0.1)'); drGlow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = drGlow; ctx.beginPath(); ctx.arc(0, 0, 80, 0, Math.PI * 2); ctx.fill();
        // Dragon body
        ctx.fillStyle = '#1a3a6a'; ctx.beginPath();
        ctx.moveTo(40, 0); ctx.quadraticCurveTo(20, -20, -10, -15);
        ctx.quadraticCurveTo(-30, -10, -50, 5);
        ctx.quadraticCurveTo(-30, 15, -10, 15);
        ctx.quadraticCurveTo(20, 20, 40, 0);
        ctx.fill();
        // Wings
        const wingFlap = Math.sin(dr.life * 0.4) * 20;
        ctx.fillStyle = 'rgba(30,80,160,0.8)';
        ctx.beginPath(); ctx.moveTo(0, -10); ctx.quadraticCurveTo(-20, -50 - wingFlap, -50, -30 - wingFlap); ctx.quadraticCurveTo(-30, -15, 0, -10); ctx.fill();
        ctx.beginPath(); ctx.moveTo(0, 10); ctx.quadraticCurveTo(-20, 50 + wingFlap, -50, 30 + wingFlap); ctx.quadraticCurveTo(-30, 15, 0, 10); ctx.fill();
        // Head
        ctx.fillStyle = '#2a4a8a'; ctx.beginPath(); ctx.arc(35, 0, 12, 0, Math.PI * 2); ctx.fill();
        // Eye
        ctx.fillStyle = '#0ff'; ctx.beginPath(); ctx.arc(40, -3, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(41, -3, 1.5, 0, Math.PI * 2); ctx.fill();
        // Horns
        ctx.strokeStyle = '#4a6aaa'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(30, -10); ctx.lineTo(25, -22); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(35, -10); ctx.lineTo(32, -20); ctx.stroke();
        // Tail
        ctx.strokeStyle = '#1a3a6a'; ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-50, 5); ctx.quadraticCurveTo(-70, 0 + Math.sin(dr.life * 0.3) * 10, -85, -5 + Math.sin(dr.life * 0.5) * 8); ctx.stroke();
        // Spikes on tail
        ctx.fillStyle = '#4a6aaa';
        for (let i = 0; i < 4; i++) {
          const tx = -50 - i * 9; const ty = 5 + Math.sin(dr.life * 0.3 + i) * 4 - i * 1;
          ctx.beginPath(); ctx.moveTo(tx - 2, ty); ctx.lineTo(tx, ty - 6); ctx.lineTo(tx + 2, ty); ctx.fill();
        }
        ctx.restore();
        ctx.globalAlpha = 1;
      });

      ctx.restore(); // end world-space

      // ── SCREEN-SPACE EFFECTS ──
      if (g.flash > 0) { ctx.fillStyle = g.flashColor; ctx.globalAlpha = g.flash / 15 * 0.4; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }

      // Fatality text
      g.fatalityTexts.forEach(ft => {
        const p3 = ft.life / ft.maxLife;
        const sc = p3 < 0.1 ? p3 / 0.1 : 1;
        ctx.save(); ctx.translate(W / 2, H / 2 - 80);
        ctx.scale(sc, sc); ctx.globalAlpha = Math.min(1, ft.life / 30);
        ctx.font = 'bold 50px "Press Start 2P", Georgia, serif'; ctx.textAlign = 'center';
        ctx.shadowBlur = 30; ctx.shadowColor = '#f00';
        ctx.fillStyle = '#f00'; ctx.fillText(ft.text, 0, 0);
        ctx.font = 'bold 22px "Orbitron", sans-serif'; ctx.fillStyle = '#fa0';
        ctx.shadowColor = '#fa0'; ctx.shadowBlur = 20;
        ctx.fillText('FATALITY!', 0, 50);
        ctx.shadowBlur = 0; ctx.restore();
      });

      // Intro/KO overlays
      if (g.rs === 'intro') {
        const p3 = 1 - g.introTimer / 80;
        ctx.fillStyle = `rgba(0,0,0,${0.6 * (1 - p3)})`; ctx.fillRect(0, 0, W, H);
        ctx.save(); ctx.translate(W / 2, H / 2 - 50); ctx.scale(0.5 + p3 * 0.5, 0.5 + p3 * 0.5);
        ctx.font = 'bold 48px "Press Start 2P", Georgia, serif'; ctx.textAlign = 'center';
        ctx.shadowBlur = 30; ctx.shadowColor = '#f00';
        ctx.fillStyle = '#c44'; ctx.globalAlpha = Math.min(1, p3 * 3);
        ctx.fillText(`ROUND ${g.round}`, 0, 0);
        if (p3 > 0.5) { ctx.font = 'bold 36px "Orbitron", sans-serif'; ctx.fillStyle = '#ff4'; ctx.shadowColor = '#ff4'; ctx.globalAlpha = (p3 - 0.5) * 2; ctx.fillText('FIGHT!', 0, 55); }
        ctx.shadowBlur = 0; ctx.restore();
      }
      if (g.rs === 'ko') {
        const p3 = 1 - g.koTimer / 280;
        const vig = ctx.createRadialGradient(W / 2, H / 2, 80, W / 2, H / 2, W / 2);
        vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, `rgba(0,0,0,${Math.min(0.7, p3 * 2)})`);
        ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);
        ctx.save(); ctx.translate(W / 2, H / 2 - 40);
        ctx.scale(p3 < 0.1 ? p3 / 0.1 : 1, p3 < 0.1 ? p3 / 0.1 : 1);
        ctx.font = 'bold 72px "Press Start 2P", Georgia, serif'; ctx.textAlign = 'center'; ctx.shadowBlur = 40; ctx.shadowColor = '#f00';
        ctx.fillStyle = '#a00'; ctx.fillText('K.O.', 0, 0); ctx.shadowBlur = 0;
        const winner = g.fighters.find(f => f.hp > 0);
        if (winner && winner.combo > 2) { ctx.font = 'bold 24px "Orbitron", sans-serif'; ctx.fillStyle = '#ff4'; ctx.shadowBlur = 15; ctx.shadowColor = '#ff4'; ctx.fillText(`${winner.combo} HIT COMBO!`, 0, 55); ctx.shadowBlur = 0; }
        ctx.restore();
      }
      // Vignette
      const vig2 = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, W * 0.7);
      vig2.addColorStop(0, 'rgba(0,0,0,0)'); vig2.addColorStop(1, 'rgba(0,0,0,0.35)');
      ctx.fillStyle = vig2; ctx.fillRect(0, 0, W, H);
      ctx.restore();
      aid = requestAnimationFrame(render);
    };
    aid = requestAnimationFrame(render);
    return () => { cancelAnimationFrame(aid); window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
  }, [gameScreen, drawFighter, spawnBlood, spawnSparks, sever, spawnGore, spawnAfterimage, spawnRing, spawnLightning, spawnBullet, spawnWallSparks, sfxVolume, ttsEnabled, selectedP1, selectedP2]);

  // ═══════════════════════════════════════════════════════
  // MAIN MENU
  // ═══════════════════════════════════════════════════════
  if (gameScreen === 'menu') {
    return (
      <div className="relative w-full h-full flex items-center justify-center bg-black select-none overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(ellipse at 50% 120%, #1a0000 0%, #000 60%)',
        }} />
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,0,0,0.03) 2px, rgba(255,0,0,0.03) 4px)',
        }} />

        {/* Dragon emblem glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #f00 0%, transparent 70%)', animation: 'pulse 3s ease-in-out infinite' }} />

        <div className="relative z-10 flex flex-col items-center gap-8">
          {/* Title */}
          <div className="text-center mb-4">
            <h1 className="text-5xl md:text-6xl font-bold tracking-[0.3em] mb-2" style={{
              fontFamily: '"Press Start 2P", cursive',
              color: '#c00',
              textShadow: '0 0 30px #f00, 0 0 60px #a00, 0 0 90px #600, 0 4px 0 #400',
            }}>
              MORTAL
            </h1>
            <h1 className="text-5xl md:text-6xl font-bold tracking-[0.3em]" style={{
              fontFamily: '"Press Start 2P", cursive',
              color: '#ff4',
              textShadow: '0 0 30px #fa0, 0 0 60px #a60, 0 4px 0 #640',
            }}>
              RAGDOLL
            </h1>
            <div className="mt-3 text-sm tracking-[0.5em] uppercase" style={{
              fontFamily: '"Orbitron", sans-serif',
              color: '#666',
            }}>
              Arena of Carnage
            </div>
          </div>

          {/* Dragon separator */}
          <div className="w-64 h-[2px]" style={{ background: 'linear-gradient(90deg, transparent, #800, #f00, #800, transparent)' }} />

          {/* Menu buttons */}
          <div className="flex flex-col gap-4 items-center">
            <button
              onClick={() => setGameScreen('campaignSelect')}
              className="group relative px-12 py-4 text-xl font-bold tracking-[0.2em] uppercase transition-all duration-300 hover:scale-105"
              style={{
                fontFamily: '"Orbitron", sans-serif',
                color: '#fff',
                background: 'linear-gradient(180deg, rgba(200,120,0,0.8) 0%, rgba(100,50,0,0.9) 100%)',
                border: '2px solid #da0',
                clipPath: 'polygon(8% 0%, 100% 0%, 92% 100%, 0% 100%)',
                textShadow: '0 0 10px #fa0',
              }}
            >
              <span className="relative z-10">⚔ CAMPAIGN</span>
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{
                background: 'linear-gradient(180deg, rgba(255,150,0,0.3) 0%, rgba(180,80,0,0.4) 100%)',
              }} />
            </button>

            <button
              onClick={() => setGameScreen('charSelect')}
              className="group relative px-12 py-4 text-xl font-bold tracking-[0.2em] uppercase transition-all duration-300 hover:scale-105"
              style={{
                fontFamily: '"Orbitron", sans-serif',
                color: '#fff',
                background: 'linear-gradient(180deg, rgba(180,0,0,0.8) 0%, rgba(80,0,0,0.9) 100%)',
                border: '2px solid #a00',
                clipPath: 'polygon(8% 0%, 100% 0%, 92% 100%, 0% 100%)',
                textShadow: '0 0 10px #f00',
              }}
            >
              <span className="relative z-10">AI vs AI</span>
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{
                background: 'linear-gradient(180deg, rgba(255,0,0,0.3) 0%, rgba(180,0,0,0.4) 100%)',
              }} />
            </button>

            <button
              onClick={() => setGameScreen('settings')}
              className="group relative px-10 py-3 text-base font-bold tracking-[0.2em] uppercase transition-all duration-300 hover:scale-105"
              style={{
                fontFamily: '"Orbitron", sans-serif',
                color: '#aaa',
                background: 'linear-gradient(180deg, rgba(40,40,40,0.8) 0%, rgba(20,20,20,0.9) 100%)',
                border: '1px solid #444',
                clipPath: 'polygon(6% 0%, 100% 0%, 94% 100%, 0% 100%)',
              }}
            >
              SETTINGS
            </button>
          </div>

          {/* Controls hint */}
          <div className="mt-2 text-[9px] tracking-[0.2em] uppercase text-center" style={{ fontFamily: '"Orbitron", sans-serif', color: '#444' }}>
            Campaign: WASD/Arrows move • J/Z slash • K/X heavy • L/C kick • Shift block • Space dodge • F shoot • Q+E special
          </div>
          <div className="text-[9px] tracking-[0.2em] uppercase text-center" style={{ fontFamily: '"Orbitron", sans-serif', color: '#333' }}>
            PS4 Controller supported • □ slash • △ heavy • ○ kick • L1 block • R1+R2 special
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  // CAMPAIGN CHARACTER SELECT
  // ═══════════════════════════════════════════════════════
  if (gameScreen === 'campaignSelect') {
    const selChar = getCharacter(campaignChar);
    const weaponLabels: Record<string, string> = {
      greatsword: '⚔ Greatsword', axe: '🪓 Battle Axe', longsword: '🗡 Longsword', spear: '🔱 Spear',
      dagger: '🗡 Twin Daggers', hammer: '🔨 War Hammer', scythe: '⚰ Scythe', staff: '✨ Arcane Staff',
      katana: '⚔ Katana', claws: '🐾 Claws', flail: '⛓ Flail', fists: '👊 Fists',
    };
    return (
      <div className="relative w-full h-full flex flex-col items-center justify-center bg-black select-none overflow-hidden">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, rgba(60,40,0,0.4) 0%, rgba(0,0,0,0.95) 70%)' }} />
        {/* Animated background particles */}
        <div className="absolute inset-0 overflow-hidden opacity-20">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="absolute rounded-full animate-pulse" style={{
              width: 2 + Math.random() * 4, height: 2 + Math.random() * 4,
              left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
              background: '#fa0', animationDelay: `${Math.random() * 3}s`, animationDuration: `${2 + Math.random() * 3}s`,
            }} />
          ))}
        </div>
        <div className="relative z-10 mb-2">
          <h2 className="text-2xl font-bold tracking-[0.3em] uppercase text-center" style={{ fontFamily: '"Press Start 2P", cursive', color: '#fa0', textShadow: '0 0 20px rgba(255,150,0,0.5), 0 0 40px rgba(255,100,0,0.2)' }}>
            CHOOSE YOUR WARRIOR
          </h2>
          <p className="text-center text-xs mt-1" style={{ fontFamily: '"Orbitron", sans-serif', color: '#886' }}>
            12 bosses await. Each deadlier than the last.
          </p>
        </div>

        <div className="relative z-10 flex gap-6 w-full max-w-6xl px-4">
          {/* Character Grid - left side */}
          <div className="grid grid-cols-4 gap-2 flex-shrink-0" style={{ width: '55%' }}>
            {CHARACTERS.map((char) => {
              const isSel = campaignChar === char.id;
              return (
                <button key={char.id} onClick={() => setCampaignChar(char.id)}
                  className="relative flex flex-col items-center p-1.5 rounded transition-all duration-200 hover:scale-105"
                  style={{
                    background: isSel ? 'rgba(255,150,0,0.3)' : 'rgba(20,20,20,0.7)',
                    border: isSel ? '2px solid #fa0' : '1px solid #333',
                    boxShadow: isSel ? '0 0 20px rgba(255,150,0,0.4), inset 0 0 15px rgba(255,150,0,0.1)' : 'none',
                  }}>
                  <canvas ref={(cvs) => { if (cvs) { const ctx2 = cvs.getContext('2d'); if (ctx2) { ctx2.clearRect(0, 0, 100, 120); drawCharPreview(ctx2, char, 50, 95, 0.85, false); } } }} width={100} height={120} className="pointer-events-none" />
                  <span className="text-[8px] font-bold tracking-wider" style={{ fontFamily: '"Orbitron", sans-serif', color: isSel ? '#fa0' : '#aaa' }}>{char.name}</span>
                  <span className="text-[6px]" style={{ fontFamily: '"Orbitron", sans-serif', color: '#555' }}>{char.title}</span>
                </button>
              );
            })}
          </div>

          {/* Selected Character Detail Panel - right side */}
          <div className="flex flex-col items-center gap-3 flex-1 p-4 rounded-lg" style={{ background: 'rgba(30,25,10,0.6)', border: '1px solid #553300', boxShadow: '0 0 30px rgba(255,150,0,0.1)' }}>
            <canvas ref={(cvs) => { if (cvs) { const ctx2 = cvs.getContext('2d'); if (ctx2) { ctx2.clearRect(0, 0, 200, 240); drawCharPreview(ctx2, selChar, 100, 190, 1.7, true); } } }} width={200} height={240} className="pointer-events-none" />
            <h3 className="text-lg font-bold tracking-[0.2em]" style={{ fontFamily: '"Press Start 2P", cursive', color: selChar.color2, textShadow: `0 0 15px ${selChar.color2}66` }}>
              {selChar.name}
            </h3>
            <p className="text-xs italic" style={{ fontFamily: '"Orbitron", sans-serif', color: '#aa8' }}>{selChar.title}</p>
            {/* Weapon */}
            <div className="text-xs px-3 py-1 rounded" style={{ background: 'rgba(255,200,100,0.1)', border: '1px solid #553', fontFamily: '"Orbitron", sans-serif', color: '#ca8' }}>
              {weaponLabels[selChar.weaponKey] || selChar.weaponKey}
            </div>
            {/* Special */}
            <div className="text-[10px] text-center" style={{ fontFamily: '"Orbitron", sans-serif', color: selChar.specialColor }}>
              ★ {selChar.specialName}
            </div>
            {/* Stats */}
            <div className="w-full space-y-1 mt-1">
              {[
                { label: 'BODY', val: selChar.bodyScale, color: '#f84' },
                { label: 'HEAD', val: selChar.headScale, color: '#8af' },
                { label: 'ARMOR', val: selChar.armorType === 'heavy' ? 1.0 : selChar.armorType === 'medium' ? 0.7 : selChar.armorType === 'light' ? 0.4 : selChar.armorType === 'robe' ? 0.3 : 0.1, color: '#8f8' },
              ].map(stat => (
                <div key={stat.label} className="flex items-center gap-2 text-[9px]" style={{ fontFamily: '"Orbitron", sans-serif' }}>
                  <span style={{ color: '#666', width: 44 }}>{stat.label}</span>
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.min(stat.val * 75, 100)}%`, background: stat.color, boxShadow: `0 0 6px ${stat.color}88` }} />
                  </div>
                </div>
              ))}
            </div>
            {/* Taunt line */}
            <p className="text-[9px] italic text-center mt-1" style={{ fontFamily: 'Georgia, serif', color: '#776' }}>
              "{selChar.tauntLines[0]}"
            </p>
          </div>
        </div>

        <div className="relative z-10 flex gap-4 mt-4">
          <button onClick={() => { const cs = initCampaign(campaignChar); setCampaign(cs); campaignRef.current = cs; setGameScreen('cinematic'); }}
            className="px-10 py-3 text-lg font-bold tracking-[0.2em] uppercase transition-all hover:scale-105"
            style={{ fontFamily: '"Orbitron", sans-serif', color: '#fff', background: 'linear-gradient(180deg, rgba(200,120,0,0.8) 0%, rgba(100,50,0,0.9) 100%)', border: '2px solid #da0', clipPath: 'polygon(8% 0%, 100% 0%, 92% 100%, 0% 100%)', textShadow: '0 0 10px #fa0' }}>
            BEGIN CAMPAIGN
          </button>
          <button onClick={() => setGameScreen('menu')}
            className="px-8 py-3 text-sm font-bold tracking-[0.2em] uppercase transition-all hover:scale-105"
            style={{ fontFamily: '"Orbitron", sans-serif', color: '#aaa', background: 'rgba(30,30,30,0.8)', border: '1px solid #444', clipPath: 'polygon(6% 0%, 100% 0%, 94% 100%, 0% 100%)' }}>
            BACK
          </button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  // CINEMATIC / STORY SCREEN
  // ═══════════════════════════════════════════════════════
  if (gameScreen === 'cinematic') {
    const cState = campaignRef.current;
    const boss = getBoss(cState.level);
    const playerChar = getCharacter(cState.playerCharId);
    const prevBoss = cState.level > 1 ? getBoss(cState.level - 1) : null;
    const showDefeatText = cState.level > 1 && cState.levelsComplete[cState.level - 2];
    return (
      <div className="relative w-full h-full flex items-center justify-center bg-black select-none overflow-hidden">
        <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 50% 80%, ${boss.color}44 0%, #000 70%)` }} />
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.02) 3px, rgba(255,255,255,0.02) 4px)' }} />
        
        <div className="relative z-10 flex flex-col items-center gap-4 max-w-4xl px-8 text-center">
          {/* Previous boss defeat text */}
          {showDefeatText && prevBoss && (
            <div className="mb-2 p-3 rounded" style={{ background: 'rgba(0,60,0,0.3)', border: '1px solid #0a0' }}>
              <p className="text-xs italic" style={{ fontFamily: '"Orbitron", sans-serif', color: '#8a8' }}>— {prevBoss.name} Defeated —</p>
              <p className="text-xs mt-1" style={{ fontFamily: 'Georgia, serif', color: '#aaa', lineHeight: '1.6' }}>"{prevBoss.storyDefeat}"</p>
            </div>
          )}
          {/* Level header */}
          <div>
            <p className="text-xs tracking-[0.5em] uppercase" style={{ fontFamily: '"Orbitron", sans-serif', color: '#666' }}>
              Level {cState.level} of 12
            </p>
            <h2 className="text-xl font-bold tracking-[0.2em] mt-1" style={{ fontFamily: '"Press Start 2P", cursive', color: boss.color2, textShadow: `0 0 20px ${boss.color2}88` }}>
              {boss.arenaName}
            </h2>
          </div>

          {/* VS Layout: Player vs Boss with canvases */}
          <div className="flex items-center gap-6 my-2">
            {/* Player character preview */}
            <div className="flex flex-col items-center">
              <canvas ref={(cvs) => { if (cvs) { const ctx2 = cvs.getContext('2d'); if (ctx2) { ctx2.clearRect(0, 0, 140, 180); drawCharPreview(ctx2, playerChar, 70, 145, 1.2, false); } } }} width={140} height={180} className="pointer-events-none" />
              <p className="text-xs font-bold mt-1" style={{ fontFamily: '"Orbitron", sans-serif', color: '#fa0' }}>{playerChar.name}</p>
              <p className="text-[8px]" style={{ fontFamily: '"Orbitron", sans-serif', color: '#886' }}>{playerChar.title}</p>
            </div>

            {/* VS badge */}
            <div className="flex flex-col items-center gap-1">
              <span className="text-3xl font-black" style={{ fontFamily: '"Press Start 2P", cursive', color: '#fff', textShadow: '0 0 20px rgba(255,0,0,0.5), 0 0 40px rgba(255,100,0,0.3)' }}>VS</span>
              <div className="w-16 h-[1px]" style={{ background: 'linear-gradient(90deg, transparent, #f44, transparent)' }} />
            </div>

            {/* Boss preview - bigger and more menacing */}
            <div className="flex flex-col items-center">
              <div className="relative">
                {/* Boss aura backdrop */}
                <div className="absolute inset-0 rounded-full animate-pulse" style={{ background: `radial-gradient(circle, ${boss.color}33 0%, transparent 70%)`, transform: 'scale(1.5)', animationDuration: '2s' }} />
                <canvas ref={(cvs) => { if (cvs) { const ctx2 = cvs.getContext('2d'); if (ctx2) {
                  ctx2.clearRect(0, 0, 180, 220);
                  const bossScale = 1.4 * (boss.bodyScale || 1);
                  drawCharPreview(ctx2, boss, 90, 175, bossScale, false);
                } } }} width={180} height={220} className="pointer-events-none relative z-10" />
              </div>
              <p className="text-sm font-bold mt-1" style={{ fontFamily: '"Orbitron", sans-serif', color: boss.color2, textShadow: `0 0 10px ${boss.color2}88` }}>{boss.name}</p>
              <p className="text-[9px]" style={{ fontFamily: '"Orbitron", sans-serif', color: '#a88' }}>{boss.title}</p>
            </div>
          </div>

          {/* Boss story intro */}
          <div className="p-3 rounded max-w-lg" style={{ background: 'rgba(40,0,0,0.4)', border: `1px solid ${boss.color2}33` }}>
            <p className="text-xs" style={{ fontFamily: 'Georgia, serif', color: '#bbb', lineHeight: '1.8', fontStyle: 'italic' }}>
              {boss.storyIntro}
            </p>
          </div>

          {/* Boss stats */}
          <div className="flex gap-4 text-[10px]" style={{ fontFamily: '"Orbitron", sans-serif' }}>
            {[
              { label: 'HP', val: boss.hpMultiplier, max: 2, color: '#f44' },
              { label: 'DMG', val: boss.dmgMultiplier, max: 2, color: '#f84' },
              { label: 'SPD', val: boss.speedMultiplier, max: 2, color: '#4af' },
            ].map(stat => (
              <div key={stat.label} className="flex items-center gap-1">
                <span style={{ color: '#666' }}>{stat.label}</span>
                <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <div className="h-full rounded-full" style={{ width: `${(stat.val / stat.max) * 100}%`, background: stat.color, boxShadow: `0 0 4px ${stat.color}88` }} />
                </div>
              </div>
            ))}
          </div>

          {/* Score */}
          {cState.totalScore > 0 && (
            <p className="text-[10px]" style={{ fontFamily: '"Orbitron", sans-serif', color: '#555' }}>Total Score: {cState.totalScore}</p>
          )}

          <button onClick={() => setGameScreen('campaignFight')}
            className="px-12 py-3 text-lg font-bold tracking-[0.2em] uppercase transition-all hover:scale-105 mt-1"
            style={{ fontFamily: '"Orbitron", sans-serif', color: '#fff', background: `linear-gradient(180deg, ${boss.color2}cc 0%, ${boss.color}cc 100%)`, border: `2px solid ${boss.color2}`, clipPath: 'polygon(8% 0%, 100% 0%, 92% 100%, 0% 100%)', textShadow: `0 0 10px ${boss.color2}` }}>
            FIGHT {boss.name}
          </button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  // VICTORY / END SCREEN
  // ═══════════════════════════════════════════════════════
  if (gameScreen === 'victory') {
    const cState = campaign;
    const playerChar = getCharacter(cState.playerCharId);
    return (
      <div className="relative w-full h-full flex items-center justify-center bg-black select-none overflow-hidden">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 30%, rgba(200,150,0,0.15) 0%, #000 70%)' }} />
        <div className="relative z-10 flex flex-col items-center gap-4 max-w-2xl px-8 text-center">
          <h1 className="text-4xl font-bold tracking-[0.3em]" style={{ fontFamily: '"Press Start 2P", cursive', color: '#fc0', textShadow: '0 0 30px #fa0, 0 0 60px #a60' }}>
            IMMORTAL
          </h1>
          <p className="text-sm tracking-[0.3em] uppercase" style={{ fontFamily: '"Orbitron", sans-serif', color: '#886' }}>
            {playerChar.name} has conquered all 12 bosses
          </p>
          <div className="w-64 h-[2px] my-2" style={{ background: 'linear-gradient(90deg, transparent, #da0, #fc0, #da0, transparent)' }} />
          {/* Ending story */}
          <div className="p-6 rounded max-w-lg" style={{ background: 'rgba(40,30,0,0.4)', border: '1px solid #886' }}>
            <p className="text-sm italic mb-3" style={{ fontFamily: 'Georgia, serif', color: '#dda', lineHeight: '1.8' }}>
              The God of Death crumbles to ash. The arena, built on blood and suffering for a thousand years, begins to collapse.
            </p>
            <p className="text-sm italic mb-3" style={{ fontFamily: 'Georgia, serif', color: '#bba', lineHeight: '1.8' }}>
              As the walls fall, {playerChar.name} walks out into the sunlight — the first warrior to ever leave the Arena of Carnage alive.
            </p>
            <p className="text-sm italic" style={{ fontFamily: 'Georgia, serif', color: '#998', lineHeight: '1.8' }}>
              The world will remember this day. The day Death itself was defeated. The day a mortal became... immortal.
            </p>
          </div>
          {/* Final Score */}
          <div className="mt-2 p-4 rounded w-full max-w-md" style={{ background: 'rgba(20,20,20,0.8)', border: '1px solid #444' }}>
            <h3 className="text-lg font-bold mb-3" style={{ fontFamily: '"Orbitron", sans-serif', color: '#fc0' }}>FINAL SCORE</h3>
            <div className="grid grid-cols-2 gap-2 text-left text-sm" style={{ fontFamily: '"Orbitron", sans-serif' }}>
              <span style={{ color: '#888' }}>Total Score:</span><span style={{ color: '#fc0' }}>{cState.totalScore.toLocaleString()}</span>
              <span style={{ color: '#888' }}>Bosses Defeated:</span><span style={{ color: '#0f0' }}>{cState.levelsComplete.filter(Boolean).length} / 12</span>
              <span style={{ color: '#888' }}>Best Combo:</span><span style={{ color: '#f80' }}>{cState.bestCombo} hits</span>
              <span style={{ color: '#888' }}>Total Time:</span><span style={{ color: '#8af' }}>{Math.floor(cState.totalTime / 60)}m {cState.totalTime % 60}s</span>
            </div>
            {/* Per-level scores */}
            <div className="mt-3 pt-3" style={{ borderTop: '1px solid #333' }}>
              <p className="text-[10px] mb-2" style={{ color: '#666' }}>LEVEL SCORES</p>
              <div className="flex flex-wrap gap-1 justify-center">
                {cState.levelScores.map((score, i) => (
                  <span key={i} className="px-2 py-1 text-[9px] rounded" style={{ background: 'rgba(255,200,0,0.1)', color: '#aa8', border: '1px solid #443' }}>
                    L{i + 1}: {score}
                  </span>
                ))}
              </div>
            </div>
          </div>
          {/* Rating */}
          <div className="mt-1">
            <span className="text-2xl font-bold" style={{ fontFamily: '"Press Start 2P", cursive', color: cState.totalScore > 8000 ? '#fc0' : cState.totalScore > 5000 ? '#aaa' : '#866' }}>
              {cState.totalScore > 8000 ? '★★★ LEGENDARY ★★★' : cState.totalScore > 5000 ? '★★ CHAMPION ★★' : '★ SURVIVOR ★'}
            </span>
          </div>
          <button onClick={() => setGameScreen('menu')}
            className="px-10 py-3 mt-2 text-base font-bold tracking-[0.2em] uppercase transition-all hover:scale-105"
            style={{ fontFamily: '"Orbitron", sans-serif', color: '#fc0', background: 'linear-gradient(180deg, rgba(100,80,0,0.8) 0%, rgba(40,30,0,0.9) 100%)', border: '2px solid #da0', clipPath: 'polygon(8% 0%, 100% 0%, 92% 100%, 0% 100%)' }}>
            MAIN MENU
          </button>
        </div>
      </div>
    );
  }


  // ═══════════════════════════════════════════════════════
  if (gameScreen === 'settings') {
    return (
      <div className="relative w-full h-full flex items-center justify-center bg-black select-none overflow-hidden">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 50%, #0a0008 0%, #000 70%)' }} />

        <div className="relative z-10 flex flex-col items-center gap-6 w-full max-w-md px-8">
          <h2 className="text-3xl font-bold tracking-[0.3em] mb-6" style={{
            fontFamily: '"Press Start 2P", cursive',
            color: '#c00',
            textShadow: '0 0 20px #a00',
          }}>
            SETTINGS
          </h2>

          <div className="w-full space-y-6">
            {/* SFX Volume */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold tracking-widest uppercase" style={{ fontFamily: '"Orbitron", sans-serif', color: '#888' }}>
                SFX Volume: {Math.round(sfxVolume * 100)}%
              </label>
              <input
                type="range" min="0" max="100" value={sfxVolume * 100}
                onChange={e => setSfxVolume(Number(e.target.value) / 100)}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                style={{ accentColor: '#c00', background: 'linear-gradient(90deg, #400, #c00)' }}
              />
            </div>

            {/* TTS Toggle */}
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold tracking-widest uppercase" style={{ fontFamily: '"Orbitron", sans-serif', color: '#888' }}>
                Voice Lines (TTS)
              </label>
              <button
                onClick={() => setTtsEnabled(!ttsEnabled)}
                className="px-4 py-2 text-sm font-bold transition-all"
                style={{
                  fontFamily: '"Orbitron", sans-serif',
                  color: ttsEnabled ? '#0f0' : '#f00',
                  background: ttsEnabled ? 'rgba(0,80,0,0.4)' : 'rgba(80,0,0,0.4)',
                  border: `1px solid ${ttsEnabled ? '#0a0' : '#a00'}`,
                }}
              >
                {ttsEnabled ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>

          <div className="w-full h-[1px] my-4" style={{ background: 'linear-gradient(90deg, transparent, #333, transparent)' }} />

          <button
            onClick={() => setGameScreen('menu')}
            className="px-10 py-3 text-base font-bold tracking-[0.2em] uppercase transition-all hover:scale-105"
            style={{
              fontFamily: '"Orbitron", sans-serif',
              color: '#aaa',
              background: 'linear-gradient(180deg, rgba(40,40,40,0.8) 0%, rgba(20,20,20,0.9) 100%)',
              border: '1px solid #444',
              clipPath: 'polygon(6% 0%, 100% 0%, 94% 100%, 0% 100%)',
            }}
          >
            BACK
          </button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  // CHARACTER SELECT SCREEN
  // ═══════════════════════════════════════════════════════
  if (gameScreen === 'charSelect') {
    // drawCharPreview is now a module-level function

    return (
      <div className="relative w-full h-full flex flex-col items-center justify-center bg-black select-none overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(ellipse at center, rgba(40,0,0,0.6) 0%, rgba(0,0,0,0.95) 70%)',
        }} />

        {/* Title */}
        <div className="relative z-10 mb-4">
          <h2 className="text-3xl font-bold tracking-[0.3em] uppercase text-center" style={{
            fontFamily: '"Orbitron", sans-serif',
            color: '#f44',
            textShadow: '0 0 20px rgba(255,0,0,0.5), 0 0 40px rgba(255,0,0,0.2)',
          }}>
            CHOOSE YOUR FIGHTERS
          </h2>
          <p className="text-center text-sm mt-1" style={{
            fontFamily: '"Orbitron", sans-serif',
            color: selectingFor === 1 ? '#f88' : '#88f',
          }}>
            Selecting for {selectingFor === 1 ? 'PLAYER 1 (LEFT)' : 'PLAYER 2 (RIGHT)'}
          </p>
        </div>

        {/* Character Grid */}
        <div className="relative z-10 grid grid-cols-6 gap-2 px-4 max-w-5xl">
          {CHARACTERS.map((char) => {
            const isP1 = selectedP1 === char.id;
            const isP2 = selectedP2 === char.id;
            return (
              <button
                key={char.id}
                onClick={() => {
                  if (selectingFor === 1) {
                    setSelectedP1(char.id);
                    setSelectingFor(2);
                  } else {
                    setSelectedP2(char.id);
                    setSelectingFor(1);
                  }
                }}
                className="relative flex flex-col items-center p-2 rounded transition-all duration-200 hover:scale-110"
                style={{
                  background: isP1 ? 'rgba(255,0,0,0.25)' : isP2 ? 'rgba(0,100,255,0.25)' : 'rgba(30,30,30,0.6)',
                  border: isP1 ? '2px solid #f44' : isP2 ? '2px solid #48f' : '1px solid #333',
                  boxShadow: isP1 ? '0 0 15px rgba(255,0,0,0.3)' : isP2 ? '0 0 15px rgba(0,100,255,0.3)' : 'none',
                }}
              >
                {/* Mini canvas for character preview */}
                <canvas
                  ref={(cvs) => {
                    if (cvs) {
                      const ctx2 = cvs.getContext('2d');
                      if (ctx2) {
                        ctx2.clearRect(0, 0, 80, 100);
                        drawCharPreview(ctx2, char, 40, 80, 0.7, false);
                      }
                    }
                  }}
                  width={80}
                  height={100}
                  className="pointer-events-none"
                />
                <span className="text-[9px] font-bold tracking-wider mt-1" style={{
                  fontFamily: '"Orbitron", sans-serif',
                  color: isP1 ? '#f88' : isP2 ? '#88f' : '#aaa',
                }}>{char.name}</span>
                <span className="text-[7px]" style={{
                  fontFamily: '"Orbitron", sans-serif',
                  color: '#666',
                }}>{char.title}</span>
                {isP1 && <span className="absolute top-0 left-0 text-[8px] px-1 font-bold" style={{ background: '#a00', color: '#fff' }}>P1</span>}
                {isP2 && <span className="absolute top-0 right-0 text-[8px] px-1 font-bold" style={{ background: '#00a', color: '#fff' }}>P2</span>}
              </button>
            );
          })}
        </div>

        {/* Selected fighters display */}
        <div className="relative z-10 flex items-center gap-8 mt-4">
          <div className="text-center">
            <canvas
              ref={(cvs) => {
                if (cvs) {
                  const ctx2 = cvs.getContext('2d');
                  if (ctx2) {
                    ctx2.clearRect(0, 0, 120, 150);
                    drawCharPreview(ctx2, getCharacter(selectedP1), 60, 120, 1.1, true);
                  }
                }
              }}
              width={120}
              height={150}
              className="pointer-events-none"
            />
            <p className="text-sm font-bold" style={{ fontFamily: '"Orbitron", sans-serif', color: '#f44', textShadow: '0 0 8px rgba(255,0,0,0.5)' }}>
              {getCharacter(selectedP1).name}
            </p>
            <p className="text-[10px]" style={{ fontFamily: '"Orbitron", sans-serif', color: '#888' }}>
              {getCharacter(selectedP1).specialName}
            </p>
          </div>

          <div className="text-4xl font-black" style={{
            fontFamily: '"Orbitron", sans-serif',
            color: '#fff',
            textShadow: '0 0 20px rgba(255,255,255,0.3)',
          }}>VS</div>

          <div className="text-center">
            <canvas
              ref={(cvs) => {
                if (cvs) {
                  const ctx2 = cvs.getContext('2d');
                  if (ctx2) {
                    ctx2.clearRect(0, 0, 120, 150);
                    drawCharPreview(ctx2, getCharacter(selectedP2), 60, 120, 1.1, true);
                  }
                }
              }}
              width={120}
              height={150}
              className="pointer-events-none"
            />
            <p className="text-sm font-bold" style={{ fontFamily: '"Orbitron", sans-serif', color: '#48f', textShadow: '0 0 8px rgba(0,100,255,0.5)' }}>
              {getCharacter(selectedP2).name}
            </p>
            <p className="text-[10px]" style={{ fontFamily: '"Orbitron", sans-serif', color: '#888' }}>
              {getCharacter(selectedP2).specialName}
            </p>
          </div>
        </div>

        {/* Buttons */}
        <div className="relative z-10 flex gap-4 mt-4">
          <button
            onClick={() => setGameScreen('fight')}
            className="px-10 py-3 text-lg font-bold tracking-[0.2em] uppercase transition-all hover:scale-105"
            style={{
              fontFamily: '"Orbitron", sans-serif',
              color: '#fff',
              background: 'linear-gradient(180deg, rgba(180,0,0,0.8) 0%, rgba(80,0,0,0.9) 100%)',
              border: '2px solid #a00',
              clipPath: 'polygon(8% 0%, 100% 0%, 92% 100%, 0% 100%)',
              textShadow: '0 0 10px #f00',
            }}
          >
            FIGHT!
          </button>
          <button
            onClick={() => setGameScreen('menu')}
            className="px-8 py-3 text-sm font-bold tracking-[0.2em] uppercase transition-all hover:scale-105"
            style={{
              fontFamily: '"Orbitron", sans-serif',
              color: '#aaa',
              background: 'rgba(30,30,30,0.8)',
              border: '1px solid #444',
              clipPath: 'polygon(6% 0%, 100% 0%, 94% 100%, 0% 100%)',
            }}
          >
            BACK
          </button>
        </div>
      </div>
    );
  }


  // ═══════════════════════════════════════════════════════
  const p1Pct = Math.max(0, (hud.p1hp / MAX_HP) * 100);
  const p2Pct = Math.max(0, (hud.p2hp / MAX_HP) * 100);

  return (
    <div className="relative w-screen h-screen bg-black select-none overflow-hidden">
      <canvas ref={canvasRef} width={W} height={H} className="w-full h-full" style={{ objectFit: 'cover' }} />

      {/* MK-STYLE HUD OVERLAY */}
      <div className="absolute top-0 left-0 right-0 pointer-events-none" style={{ maxWidth: W, margin: '0 auto' }}>
        {/* Top bar background */}
        <div className="relative" style={{ height: 80, paddingTop: 8, background: 'linear-gradient(180deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 80%, transparent 100%)' }}>

          {/* Timer center */}
          <div className="absolute left-1/2 -translate-x-1/2 top-1 z-10">
            <div className="relative">
              <div className="w-14 h-14 flex items-center justify-center" style={{
                background: 'linear-gradient(180deg, #222 0%, #111 100%)',
                border: '2px solid #555',
                clipPath: 'polygon(15% 0%, 85% 0%, 100% 50%, 85% 100%, 15% 100%, 0% 50%)',
              }}>
                <span className="text-2xl font-bold tabular-nums" style={{
                  fontFamily: '"Press Start 2P", cursive',
                  color: hud.timer <= 10 ? '#f00' : '#ddd',
                  textShadow: hud.timer <= 10 ? '0 0 10px #f00' : 'none',
                }}>{hud.timer}</span>
              </div>
              <div className="text-center mt-0.5">
                <span className="text-[8px] tracking-[0.3em] uppercase" style={{ fontFamily: '"Orbitron", sans-serif', color: '#555' }}>
                  ROUND {hud.round}
                </span>
              </div>
            </div>
          </div>

          {/* P1 Side */}
          <div className="absolute left-3 top-2 right-1/2 pr-10">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold tracking-[0.15em]" style={{
                fontFamily: '"Orbitron", sans-serif',
                color: '#e44',
                textShadow: '0 0 8px rgba(255,0,0,0.5)',
              }}>{hud.n1}</span>
              <span className="text-[8px] ml-1" style={{ fontFamily: '"Orbitron", sans-serif', color: 'rgba(255,100,100,0.4)' }}>{hud.w1}</span>
              {hud.p1limb && <span className="text-[9px]">🦴</span>}
            </div>
            {/* HP Bar - angled MK style */}
            <div className="relative h-6 overflow-hidden" style={{
              clipPath: 'polygon(0% 0%, 100% 0%, 97% 100%, 0% 100%)',
              background: '#111',
              border: '1px solid #600',
            }}>
              <div className="absolute inset-0 transition-all duration-300" style={{
                width: `${p1Pct}%`,
                background: p1Pct > 30
                  ? 'linear-gradient(180deg, #e22 0%, #a00 40%, #800 100%)'
                  : 'linear-gradient(180deg, #ff4 0%, #f80 40%, #a40 100%)',
                boxShadow: p1Pct <= 30 ? 'inset 0 0 15px rgba(255,200,0,0.3)' : 'inset 0 0 10px rgba(255,0,0,0.2)',
              }} />
              {/* Health bar shine */}
              <div className="absolute top-0 left-0 right-0 h-[3px] opacity-40" style={{
                background: 'linear-gradient(180deg, rgba(255,255,255,0.4), transparent)',
              }} />
              {/* HP text */}
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold" style={{
                fontFamily: '"Orbitron", sans-serif',
                color: 'rgba(255,255,255,0.5)',
              }}>{Math.ceil(hud.p1hp)}</span>
            </div>
            {/* Stamina */}
            <div className="h-[5px] mt-[2px] overflow-hidden" style={{
              clipPath: 'polygon(0% 0%, 100% 0%, 98% 100%, 0% 100%)',
              background: '#0a0a00',
            }}>
              <div className="h-full transition-all duration-200" style={{
                width: `${hud.p1st}%`,
                background: 'linear-gradient(90deg, #a80, #ee0)',
              }} />
            </div>
            {/* Win markers */}
            <div className="flex gap-1.5 mt-1">
              {[0, 1].map(i => (
                <div key={i} className="w-3 h-3 transition-all" style={{
                  background: i < hud.p1w ? 'radial-gradient(circle, #f44, #a00)' : 'transparent',
                  border: i < hud.p1w ? '1px solid #f66' : '1px solid #400',
                  boxShadow: i < hud.p1w ? '0 0 6px #f00' : 'none',
                  clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
                }} />
              ))}
            </div>
          </div>

          {/* P2 Side */}
          <div className="absolute right-3 top-2 left-1/2 pl-10">
            <div className="flex items-center gap-2 mb-1 justify-end">
              <span className="text-[8px]" style={{ fontFamily: '"Orbitron", sans-serif', color: 'rgba(100,150,255,0.4)' }}>{hud.w2}</span>
              <span className="text-xs font-bold tracking-[0.15em]" style={{
                fontFamily: '"Orbitron", sans-serif',
                color: '#48f',
                textShadow: '0 0 8px rgba(0,100,255,0.5)',
              }}>{hud.n2}</span>
              {hud.p2limb && <span className="text-[9px]">🦴</span>}
            </div>
            {/* HP Bar - reversed angle */}
            <div className="relative h-6 overflow-hidden" style={{
              clipPath: 'polygon(3% 0%, 100% 0%, 100% 100%, 0% 100%)',
              background: '#111',
              border: '1px solid #006',
            }}>
              <div className="absolute inset-0 transition-all duration-300 ml-auto" style={{
                width: `${p2Pct}%`,
                background: p2Pct > 30
                  ? 'linear-gradient(180deg, #44e 0%, #00a 40%, #008 100%)'
                  : 'linear-gradient(180deg, #ff4 0%, #f80 40%, #a40 100%)',
                boxShadow: p2Pct <= 30 ? 'inset 0 0 15px rgba(255,200,0,0.3)' : 'inset 0 0 10px rgba(0,0,255,0.2)',
              }} />
              <div className="absolute top-0 left-0 right-0 h-[3px] opacity-40" style={{
                background: 'linear-gradient(180deg, rgba(255,255,255,0.4), transparent)',
              }} />
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-bold" style={{
                fontFamily: '"Orbitron", sans-serif',
                color: 'rgba(255,255,255,0.5)',
              }}>{Math.ceil(hud.p2hp)}</span>
            </div>
            {/* Stamina */}
            <div className="h-[5px] mt-[2px] overflow-hidden" style={{
              clipPath: 'polygon(2% 0%, 100% 0%, 100% 100%, 0% 100%)',
              background: '#0a0a00',
            }}>
              <div className="h-full transition-all duration-200 ml-auto" style={{
                width: `${hud.p2st}%`,
                background: 'linear-gradient(90deg, #ee0, #a80)',
              }} />
            </div>
            {/* Win markers */}
            <div className="flex gap-1.5 mt-1 justify-end">
              {[0, 1].map(i => (
                <div key={i} className="w-3 h-3 transition-all" style={{
                  background: i < hud.p2w ? 'radial-gradient(circle, #48f, #00a)' : 'transparent',
                  border: i < hud.p2w ? '1px solid #68f' : '1px solid #004',
                  boxShadow: i < hud.p2w ? '0 0 6px #00f' : 'none',
                  clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
                }} />
              ))}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default RagdollArena;
