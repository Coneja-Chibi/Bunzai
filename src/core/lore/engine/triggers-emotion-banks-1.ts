/**
 * Emotion pattern data, part 1 of 2: primary + secondary emotions. Ported verbatim from RoleCall's
 * triggers/emotion.ts EMOTION_PATTERNS. Pure data, no UI metadata (icons/colors
 * dropped, they belong to the editor, not the matcher). Matching logic lives in triggers-emotion.ts.
 */
export interface EmotionPattern {
  /** Simple keywords, matched with word boundaries */
  keywords: string[];
  /** Multi-word phrases, matched as-is with word boundaries */
  phrases: string[];
  /** Regex patterns for complex expressions */
  patterns: RegExp[];
  /** If these match, the emotion does NOT match */
  antiPatterns: RegExp[];
}

export const EMOTION_BANKS_1: Record<string, EmotionPattern> = {
  joy: {
    keywords: [
      'happy', 'excited', 'thrilled', 'delighted', 'overjoyed', 'ecstatic',
      'cheerful', 'elated', 'jubilant', 'blissful', 'gleeful', 'radiant',
      'joyful', 'joyous', 'merry', 'jovial', 'upbeat', 'chipper', 'perky',
      'exuberant', 'euphoric', 'giddy', 'ebullient', 'buoyant',
      'beaming', 'grinning', 'laughing', 'smiling', 'chuckling', 'giggling',
      'snickering', 'cackling', 'howling', 'roaring',
    ],
    phrases: [
      'over the moon', 'on cloud nine', 'walking on air', 'in high spirits',
      'tickled pink', 'on top of the world', 'happy as a clam',
      'jumping for joy', 'bursting with joy', 'filled with joy',
      'lit up', 'eyes sparkling', 'face lit up', 'heart soaring',
      'couldn\'t be happier', 'so happy', 'really happy', 'very happy',
      'hell yeah', 'let\'s go', 'woohoo', 'woo hoo', 'yippee', 'hooray',
      'hurray', 'yay', 'yayyy', 'woot', 'whee', 'wahoo',
    ],
    patterns: [
      /\b(burst|broke|doubled)s?\s+(into|out|over)\s+(in(to)?\s+)?(laughter|giggles?|laughing)\b/i,
      /\b(can'?t|couldn'?t)\s+(stop|help)\s+(laughing|smiling|grinning)\b/i,
      /\b(smile|grin)s?\s+(spread|crept|broke)\s+(across|over)\b/i,
      /\blaughing\s+(so\s+)?hard\b/i,
      /\b(face|eyes)\s+(lit|light(s|ed)?)\s+up\b/i,
      /\bpunche[sd]\s+the\s+air\b/i,
      /\b(jump(ed|ing|s)?|leap(ed|ing|s)?)\s+(up\s+and\s+down|with|for)\s+(joy|excitement)\b/i,
    ],
    antiPatterns: [
      /\b(not|n't|never|barely|hardly|wasn't|isn't|aren't)\s+(really\s+)?(happy|excited|thrilled)\b/i,
      /\bunhappy\b/i,
      /\b(fake|forced|hollow|empty)\s+(smile|laugh|grin)\b/i,
      /\b(smile|grin|laugh)(s|ed|ing)?\s+(fad(es?|ed|ing)|disappear|vanish|died?|drop)\b/i,
    ],
  },

  sadness: {
    keywords: [
      'sad', 'depressed', 'melancholy', 'sorrowful', 'mournful', 'grieving',
      'heartbroken', 'devastated', 'miserable', 'gloomy', 'downcast', 'dejected',
      'crestfallen', 'disheartened', 'despondent', 'woeful', 'doleful',
      'somber', 'sullen', 'morose', 'glum', 'blue', 'down', 'low',
      'unhappy', 'joyless', 'cheerless', 'dispirited', 'dismal',
      'crying', 'weeping', 'sobbing', 'sniffling', 'whimpering', 'wailing',
      'bawling', 'blubbering', 'mourning', 'lamenting',
    ],
    phrases: [
      'in tears', 'fighting tears', 'holding back tears', 'blinked back tears',
      'eyes welling', 'eyes watering', 'tears streaming', 'tears rolling',
      'tear-stained', 'tear stained', 'teary eyed', 'teary-eyed',
      'heavy heart', 'broken heart', 'aching heart', 'heart sank',
      'lump in throat', 'choked up', 'voice cracked', 'voice broke',
      'down in the dumps', 'feeling low', 'feeling down',
      'burst into tears', 'broke down', 'breaking down',
    ],
    patterns: [
      /\btears?\s+(stream|roll|fall|drip|trickle|flow)(ed|ing|s)?\s+(down|from)\b/i,
      /\b(eye|cheek)s?\s+(glisten|shimmer|wet)\b/i,
      /\bvoice\s+(crack|break|waver|tremble|shake)(s|ed|ing)?\b/i,
      /\b(lip|chin)\s+(quiver|tremble|wobble)(s|ed|ing)?\b/i,
      /\bshoulder(s)?\s+(shak|heav)(e|es|ed|ing)\b/i,
      /\b(quiet|silent|soft)ly\s+(cry|weep|sob)(s|ed|ing)?\b/i,
      /\b(couldn'?t|can'?t)\s+(hold|keep|stop)\s+(back\s+)?(the\s+)?tears\b/i,
    ],
    antiPatterns: [
      /\b(not|n't|never|no longer)\s+(sad|crying|upset|depressed)\b/i,
      /\b(happy|joy)\s*tears\b/i,
      /\btears\s+of\s+(joy|happiness|laughter)\b/i,
      /\b(stop|stopped)\s+(crying|being sad)\b/i,
    ],
  },

  anger: {
    keywords: [
      'angry', 'furious', 'enraged', 'livid', 'irate', 'outraged',
      'seething', 'fuming', 'incensed', 'infuriated', 'wrathful', 'hostile',
      'indignant', 'resentful', 'bitter', 'aggravated', 'irritated',
      'annoyed', 'vexed', 'exasperated', 'frustrated', 'mad', 'pissed',
      'apoplectic', 'ballistic', 'raging', 'riled', 'heated',
      'yelling', 'shouting', 'screaming', 'snarling', 'growling', 'glaring',
      'snapping', 'barking', 'bellowing', 'roaring', 'ranting', 'raving',
    ],
    phrases: [
      'pissed off', 'fed up', 'had enough', 'had it', 'sick of',
      'lost temper', 'losing temper', 'loses temper', 'blew up', 'blowing up',
      'flew into a rage', 'flew off the handle', 'hit the roof', 'hit the ceiling',
      'seeing red', 'saw red', 'blood boiling', 'blood boiled',
      'steam coming out', 'about to explode', 'ready to explode',
      'through clenched teeth', 'jaw clenched', 'teeth gritted', 'fists clenched',
      'veins popping', 'face red', 'red faced', 'red-faced',
    ],
    patterns: [
      /\b(slam|pound|punch|bang|kick|threw?|hurl)(s|ed|ing)?\s+(fist|hand|table|door|wall)\b/i,
      /\bfist(s)?\s+(clench|ball|tighten|slam)(s|ed|ing)?\b/i,
      /\b(scream|yell|shout|roar|bellow)(s|ed|ing)?\s+(at|in)\b/i,
      /\bvoice\s+(rise|rose|rising|raised)\s+(in\s+)?anger\b/i,
      /\banger\s+(flash|flare|surge|bubble|boil)(s|ed|ing)?\b/i,
      /\b(stomp|storm)(s|ed|ing)?\s+(off|out|away)\b/i,
      /\bspat\s+(out|back)\b/i,
      /\bface\s+(twist|contort|darken)(s|ed|ing)?\s+(with|in)?\s*(fury|rage|anger)?\b/i,
    ],
    antiPatterns: [
      /\b(not|n't|never|no longer|wasn't|isn't)\s+(angry|mad|upset|furious)\b/i,
      /\b(calm|calmed|calming)\s+down\b/i,
      /\banger\s+(fad|dissipat|subsidf)(es?|ed|ing)\b/i,
      /\b(let go|letting go)\s+of\s+(the\s+)?anger\b/i,
    ],
  },

  fear: {
    keywords: [
      'afraid', 'scared', 'terrified', 'frightened', 'panicked', 'horrified',
      'anxious', 'nervous', 'worried', 'alarmed', 'startled', 'spooked',
      'petrified', 'aghast', 'apprehensive', 'uneasy', 'tense', 'jittery',
      'edgy', 'jumpy', 'skittish', 'wary', 'paranoid', 'dreading',
      'trembling', 'shaking', 'shivering', 'cowering', 'flinching',
      'recoiling', 'shrinking', 'quaking', 'quivering',
    ],
    phrases: [
      'heart pounding', 'heart racing', 'heart hammering', 'heart thundering',
      'blood ran cold', 'blood froze', 'froze in place', 'frozen with fear',
      'paralyzed with fear', 'rooted to the spot', 'couldn\'t move',
      'hair standing', 'hairs on end', 'spine tingling', 'chill down spine',
      'cold sweat', 'breaking out in sweat', 'palms sweating',
      'oh no', 'oh god', 'oh shit', 'oh crap', 'oh fuck',
      'breath caught', 'held breath', 'couldn\'t breathe', 'stopped breathing',
      'wide eyed', 'wide-eyed', 'eyes wide', 'eyes widened',
    ],
    patterns: [
      /\b(heart|pulse)\s+(race|pound|hammer|thunder|skip|stop)(s|ed|ing)?\b/i,
      /\bbreath\s+(catch|hitch|stop|quicken)(s|ed|ing)?\b/i,
      /\b(step|back|edge|inch)(s|ed|ing)?\s+(back|away)\s*(slowly|cautiously)?\b/i,
      /\b(body|hands?|legs?|voice)\s+(shak|trembl|quiver)(e|es|ed|ing)\b/i,
      /\bfear\s+(grip|seize|wash|surge|shoot|spike)(s|ed|ing)?\b/i,
      /\b(stomach|gut)\s+(drop|clench|churn|knot|twist)(s|ed|ing)?\b/i,
      /\bthroat\s+(tighten|close|constrict)(s|ed|ing)?\b/i,
      /\beyes\s+(dart|flick)(s|ed|ing)?\s+(around|nervously|frantically)\b/i,
    ],
    antiPatterns: [
      /\b(not|n't|never|no longer|wasn't)\s+(afraid|scared|frightened|worried)\b/i,
      /\bfear(s)?\s+(fad|vanish|disappear|melt|subside)(es?|ed|ing)?\b/i,
      /\bovercome\s+(the\s+)?fear\b/i,
      /\bnothing\s+to\s+(fear|worry|be\s+afraid)\b/i,
    ],
  },

  surprise: {
    keywords: [
      'surprised', 'shocked', 'astonished', 'amazed', 'stunned', 'startled',
      'bewildered', 'dumbfounded', 'flabbergasted', 'speechless', 'thunderstruck',
      'astounded', 'staggered', 'stupefied', 'gobsmacked', 'floored',
      'blindsided', 'dazed', 'nonplussed', 'confounded',
    ],
    phrases: [
      'taken aback', 'caught off guard', 'didn\'t expect', 'wasn\'t expecting',
      'jaw dropped', 'jaw drop', 'mouth fell open', 'mouth hanging open',
      'eyes widened', 'eyes went wide', 'eyes bulged', 'eyebrows shot up',
      'double take', 'did a double take', 'blinked in surprise',
      'what the', 'wait what', 'hold on', 'holy shit', 'holy crap',
      'no way', 'you\'re kidding', 'are you serious', 'i can\'t believe',
      'out of nowhere', 'came out of nowhere', 'out of the blue',
    ],
    patterns: [
      /\b(jaw|mouth)\s+(drop|fell?|hang|gape)(s|ped|ed|ing)?\s*(open)?\b/i,
      /\beyes?\s+(widen|bulge|pop|go\s+wide)(s|ed|ing)?\b/i,
      /\b(gasp|inhale|suck)(s|ed|ing)?\s+(sharply|audibly|in\s+surprise)?\b/i,
      /\b(stop|freeze|froze)\s+(dead|mid|in\s+(their|her|his))?\s*(tracks|motion|step)?\b/i,
      /\b(stare|gape|gawk)(s|ed|ing)?\s+(at|in\s+disbelief)\b/i,
      /\bcouldn'?t\s+believe\s+(what|their|her|his|my)\b/i,
      /\b(blink|stammer|sputter)(s|ed|ing)?\s+(in\s+)?(surprise|shock|disbelief)?\b/i,
    ],
    antiPatterns: [
      /\b(not|n't|wasn't|weren't)\s+(surprised|shocked|amazed)\b/i,
      /\bno\s+surprise\b/i,
      /\bunsurpris(ed|ing)\b/i,
      /\b(expected|saw\s+it\s+coming|knew\s+it)\b/i,
    ],
  },

  disgust: {
    keywords: [
      'disgusted', 'revolted', 'repulsed', 'sickened', 'nauseated', 'appalled',
      'repelled', 'horrified', 'offended', 'scandalized',
      'queasy', 'nauseous', 'bilious',
      'gagging', 'retching', 'grimacing', 'recoiling', 'cringing',
      'wincing', 'blanching', 'heaving',
    ],
    phrases: [
      'grossed out', 'turned stomach', 'stomach turned', 'stomach churned',
      'made sick', 'feel sick', 'felt sick', 'going to be sick',
      'threw up', 'throwing up', 'about to throw up', 'wanted to throw up',
      'wrinkled nose', 'wrinkling nose', 'nose wrinkled', 'curled lip',
      'turned away', 'looked away', 'couldn\'t look', 'couldn\'t watch',
      'bile rising', 'taste of bile', 'bitter taste',
    ],
    patterns: [
      /\b(nose|lip|face)\s+(wrinkle|curl|scrunch|twist)(s|ed|ing)?\b/i,
      /\bstomach\s+(turn|churn|heave|lurch|flip|roll)(s|ed|ing)?\b/i,
      /\b(gag|retch|heave|dry\s+heave)(s|ed|ing)?\b/i,
      /\b(look|glance|turn)(s|ed|ing)?\s+away\s+(in\s+)?(disgust|revulsion)?\b/i,
      /\bbile\s+(rise|burn|taste)(s|ed|ing)?\b/i,
      /\bshudder(s|ed|ing)?\s+(in\s+)?(disgust|revulsion)\b/i,
      /\b(vile|putrid|foul|rotten|rancid|fetid)\s+(smell|stench|odor|taste)\b/i,
    ],
    antiPatterns: [
      /\b(not|n't|wasn't)\s+(disgusted|grossed|revolted)\b/i,
    ],
  },

  love: {
    keywords: [
      'loving', 'adoring', 'cherishing', 'devoted', 'affectionate', 'passionate',
      'enamored', 'infatuated', 'smitten', 'tender', 'caring', 'fond',
      'amorous', 'besotted', 'captivated', 'enchanted', 'enthralled',
      'lovestruck', 'lovesick', 'doting', 'ardent',
    ],
    phrases: [
      'in love', 'fell in love', 'falling in love', 'head over heels',
      'deeply in love', 'madly in love', 'crazy about', 'wild about',
      'holding hands', 'held hands', 'hand in hand',
      'gazing lovingly', 'looked at lovingly', 'eyes full of love',
      'heart flutter', 'heart fluttered', 'butterflies in stomach',
      'i love you', 'love you', 'my love', 'my darling', 'my dear',
      'warm feeling', 'warmth spread', 'heart swelled', 'heart melted',
    ],
    patterns: [
      /\b(embrac|hug|hold|cuddle|snuggle|nuzzle)(e?s|ed|ing)?\s+(close|tight|gently)?\b/i,
      /\b(kiss|peck)(e?s|ed|ing)?\s+(on\s+the\s+)?(lips?|cheek|forehead|hand)?\b/i,
      /\b(caress|stroke|brush)(e?s|ed|ing)?\s+(gently|softly|tenderly)?\b/i,
      /\bheart(s)?\s+(swell|melt|ache|flutter|skip)(s|ed|ing)?\b/i,
      /\b(gaze|look|stare)(s|ed|ing)?\s+(at\s+)?(with\s+)?(love|adoration|affection)\b/i,
      /\bpull(s|ed|ing)?\s+(close|closer|into\s+(an\s+)?embrace)\b/i,
      /\b(soft|tender|loving|gentle)\s+(smile|look|gaze|touch|kiss)\b/i,
    ],
    antiPatterns: [
      /\b(don'?t|doesn'?t|didn'?t|never)\s+(love|care\s+about)\b/i,
      /\b(no\s+longer|stopped)\s+(lov|car)ing\b/i,
      /\b(hate|despise|loathe)(s|ed|ing)?\b/i,
      /\bunrequited\s+love\b/i,
      /\blove\s+(fad|die|end)(es?|ed|ing)\b/i,
    ],
  },

  trust: {
    keywords: [
      'trusting', 'confident', 'secure', 'reliable', 'faithful', 'loyal',
      'dependable', 'honest', 'sincere', 'genuine', 'assured', 'certain',
      'trustworthy', 'credible', 'believable', 'steadfast',
    ],
    phrases: [
      'i trust', 'trusts you', 'trust in', 'have faith', 'had faith',
      'count on', 'counted on', 'rely on', 'relied on', 'depend on',
      'believe in', 'believed in', 'in good hands', 'got your back',
      'can be trusted', 'worthy of trust', 'earned trust',
      'let guard down', 'lowered guard', 'opened up',
    ],
    patterns: [
      /\b(place|put|placed|putting)\s+(trust|faith|confidence)\s+in\b/i,
      /\b(trust|faith|confidence)\s+(grow|grew|build|built|strengthen)(s|ed|ing)?\b/i,
      /\bknew?\s+(could|can)\s+(trust|count\s+on|rely\s+on)\b/i,
    ],
    antiPatterns: [
      /\b(don'?t|doesn'?t|didn'?t|can'?t|couldn'?t|never)\s+trust\b/i,
      /\b(betray|deceive|lie\s+to)(s|ed|ing)?\b/i,
      /\btrust\s+(broken|shattered|destroyed|lost|gone)\b/i,
      /\b(distrust|mistrust|suspicion)\b/i,
    ],
  },

  anticipation: {
    keywords: [
      'anticipating', 'expecting', 'awaiting', 'eager', 'hopeful', 'excited',
      'impatient', 'restless', 'anxious', 'expectant',
    ],
    phrases: [
      'looking forward', 'can\'t wait', 'couldn\'t wait', 'waiting eagerly',
      'on the edge of seat', 'on edge', 'holding breath',
      'counting down', 'any moment now', 'any second now',
      'what happens next', 'what comes next', 'about to happen',
    ],
    patterns: [
      /\b(wait|await)(s|ed|ing)?\s+(eagerly|anxiously|impatiently|breathlessly)\b/i,
      /\b(anticipat|expect)(e?s|ed|ing)\s+(the|what|something)\b/i,
      /\bbreath\s+(baited|held)\b/i,
      /\b(lean|leaning)\s+forward\s+(in\s+anticipation|eagerly)?\b/i,
    ],
    antiPatterns: [
      /\b(not|wasn't|weren't)\s+(looking\s+forward|excited|eager)\b/i,
      /\b(dread|fear)ing\s+(what|the)\b/i,
    ],
  },
};
