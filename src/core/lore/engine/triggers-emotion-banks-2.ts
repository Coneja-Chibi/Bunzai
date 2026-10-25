/**
 * Emotion pattern data, part 2 of 2: complex + physical/situational emotions. Ported verbatim from
 * RoleCall's triggers/emotion.ts EMOTION_PATTERNS. See triggers-emotion-banks-1.ts
 * for the type and the primary/secondary bank; matching logic lives in triggers-emotion.ts.
 */
import type { EmotionPattern } from "./triggers-emotion-banks-1";

export const EMOTION_BANKS_2: Record<string, EmotionPattern> = {
  jealousy: {
    keywords: [
      'jealous', 'envious', 'covetous', 'resentful', 'bitter', 'begrudging',
      'possessive', 'suspicious', 'insecure', 'threatened',
      'green-eyed', 'greeneyed',
    ],
    phrases: [
      'green with envy', 'consumed by jealousy', 'jealous of',
      'wished had', 'wanted what', 'should be mine', 'should have been mine',
      'eyes narrowed', 'glared at', 'shot a look',
      'why them', 'why not me', 'it\'s not fair',
    ],
    patterns: [
      /\bjealousy\s+(flare|surge|stir|burn|gnaw)(s|ed|ing)?\b/i,
      /\b(pang|stab|twinge)\s+of\s+(jealousy|envy)\b/i,
      /\b(eye|watch|stare)(s|ed|ing)?\s+(them|her|him)\s+(together|closely)\b/i,
      /\bfist(s)?\s+(clench|tighten)(s|ed|ing)?\s+(at|when|as)\b/i,
    ],
    antiPatterns: [
      /\b(not|never|wasn't)\s+jealous\b/i,
      /\b(happy|glad)\s+for\s+(them|her|him)\b/i,
    ],
  },

  guilt: {
    keywords: [
      'guilty', 'remorseful', 'regretful', 'contrite', 'apologetic',
      'penitent', 'repentant', 'rueful', 'sheepish',
    ],
    phrases: [
      'felt guilty', 'feeling guilty', 'racked with guilt', 'consumed by guilt',
      'weighed on', 'weighing on', 'on conscience', 'couldn\'t forgive',
      'my fault', 'i\'m sorry', 'so sorry', 'should have', 'shouldn\'t have',
      'if only', 'wish had', 'wish hadn\'t', 'take it back',
      'looked away', 'couldn\'t meet eyes', 'avoided gaze',
    ],
    patterns: [
      /\bguilt\s+(gnaw|eat|weigh|nag|haunt)(s|ed|ing)?\b/i,
      /\b(pang|stab|wave)\s+of\s+guilt\b/i,
      /\bstomach\s+(twist|knot|churn)(s|ed|ing)?\s+(with\s+guilt)?\b/i,
      /\bcouldn'?t\s+(meet|look\s+at|face)\s+(their|her|his|the)\s+(eyes?|gaze)\b/i,
      /\b(look|hang|bow)(s|ed|ing)?\s+(down|away)\s+(in\s+)?(shame|guilt)?\b/i,
    ],
    antiPatterns: [
      /\b(no|without|free\s+of)\s+guilt\b/i,
      /\b(not|don't|didn't)\s+feel\s+guilty\b/i,
      /\bguilt[\s-]?free\b/i,
    ],
  },

  shame: {
    keywords: [
      'ashamed', 'embarrassed', 'humiliated', 'mortified', 'disgraced',
      'sheepish', 'abashed', 'chagrined', 'shamefaced',
    ],
    phrases: [
      'self-conscious', 'self conscious', 'face burning', 'cheeks burning',
      'blushing', 'red-faced', 'red faced', 'face red', 'cheeks red',
      'couldn\'t look', 'looked down', 'looked away', 'hide face',
      'wanted to disappear', 'wanted the ground to swallow',
      'die of embarrassment', 'so embarrassing', 'so embarrassed',
    ],
    patterns: [
      /\b(face|cheeks?)\s+(flush|burn|heat|redden|glow)(s|ed|ing)?\b/i,
      /\b(blush|flush)(e?s|ed|ing)?\s+(deep|bright)?(red|crimson|scarlet)?\b/i,
      /\bhide\s+(face|behind|from\s+view)\b/i,
      /\b(sink|sank|shrink|shrank)\s+(down|into|back)\b/i,
      /\bwish(ed|ing)?\s+(could|to)\s+(disappear|die|vanish)\b/i,
      /\b(cover|bury|hide)(s|ed|ing)?\s+(face|eyes)\s+(in|with|behind)\b/i,
    ],
    antiPatterns: [
      /\b(no|without|not)\s+(shame|embarrass)\b/i,
      /\bshameless\b/i,
      /\b(unashamed|unembarrassed)\b/i,
    ],
  },

  pride: {
    keywords: [
      'proud', 'accomplished', 'triumphant', 'victorious', 'successful',
      'self-assured', 'satisfied', 'fulfilled', 'gratified',
    ],
    phrases: [
      'chest swelled', 'swelled with pride', 'burst with pride', 'beaming with pride',
      'held head high', 'head held high', 'standing tall', 'stood tall',
      'patted on the back', 'well done', 'good job', 'nailed it',
      'sense of accomplishment', 'proud of', 'proud moment',
    ],
    patterns: [
      /\b(chest|heart)\s+(swell|puff|expand)(s|ed|ing)?\s+(with\s+pride)?\b/i,
      /\bpride\s+(swell|surge|bloom|shine)(s|ed|ing)?\b/i,
      /\b(beam|glow|radiate)(s|ed|ing)?\s+(with\s+)?(pride|satisfaction)?\b/i,
      /\bsmile(s|ed|ing)?\s+(proudly|with\s+satisfaction)\b/i,
    ],
    antiPatterns: [
      /\b(no|without|swallow(ed)?)\s+(pride)\b/i,
      /\b(ashamed|embarrassed|humiliated)\s+of\b/i,
    ],
  },

  hope: {
    keywords: [
      'hopeful', 'optimistic', 'encouraged', 'inspired', 'uplifted',
      'positive', 'expectant', 'wishful', 'sanguine', 'buoyant',
    ],
    phrases: [
      'ray of hope', 'glimmer of hope', 'spark of hope', 'held onto hope',
      'maybe things', 'things might', 'could work out', 'might work out',
      'light at the end', 'silver lining', 'look on the bright side',
      'fingers crossed', 'here\'s hoping', 'hopefully',
      'things will get better', 'it\'ll be okay', 'everything will be fine',
    ],
    patterns: [
      /\bhope\s+(flicker|spark|bloom|grow|rise|kindle)(s|ed|ing)?\b/i,
      /\b(held|clung?|hold)\s+(on)?to\s+hope\b/i,
      /\bdare(s|ed|ing)?\s+to\s+hope\b/i,
      /\beyes?\s+(light|lit)\s+up\s+(with\s+hope)?\b/i,
    ],
    antiPatterns: [
      /\b(no|lost|abandon|gave\s+up)\s+hope\b/i,
      /\bhopeless\b/i,
      /\bhope\s+(fad|die|crush|shatter)(es?|ed|ing)?\b/i,
    ],
  },

  despair: {
    keywords: [
      'despairing', 'hopeless', 'defeated', 'crushed', 'broken',
      'inconsolable', 'desolate', 'forlorn', 'wretched', 'anguished',
      'despondent', 'disconsolate', 'disheartened', 'crestfallen',
    ],
    phrases: [
      'all hope lost', 'lost all hope', 'gave up hope', 'giving up',
      'no point', 'what\'s the point', 'why bother', 'why even try',
      'nothing left', 'nothing matters', 'doesn\'t matter anymore',
      'empty inside', 'hollow inside', 'numb', 'going through the motions',
      'hit rock bottom', 'at rock bottom', 'lowest point',
    ],
    patterns: [
      /\bhope\s+(drain|fade|die|crumble|shatter|crush)(s|ed|ing)?\b/i,
      /\b(sank?|slump|collapse|crumple)(s|ed|ing)?\s+(down|to|against)\b/i,
      /\b(stare|gaze)(s|ed|ing)?\s+(blankly|emptily|into\s+nothing)\b/i,
      /\b(give|gave)\s+up\b/i,
      /\bwhat('s|\s+is)\s+the\s+point\b/i,
    ],
    antiPatterns: [
      /\b(found|regained|renewed)\s+hope\b/i,
      /\b(not|never)\s+(hopeless|defeated|giving\s+up)\b/i,
    ],
  },

  gratitude: {
    keywords: [
      'grateful', 'thankful', 'appreciative', 'indebted', 'obliged',
      'touched', 'moved', 'blessed', 'fortunate', 'humbled',
    ],
    phrases: [
      'thank you', 'thanks so much', 'so grateful', 'deeply grateful',
      'can\'t thank enough', 'means so much', 'meant the world',
      'don\'t know how to repay', 'owe you', 'in your debt',
      'from the bottom of my heart', 'truly appreciate',
    ],
    patterns: [
      /\b(thank|bless)\s+(you|her|him|them)\b/i,
      /\bgratitude\s+(swell|fill|wash|overwhelm)(s|ed|ing)?\b/i,
      /\bheart\s+(full|overflow|swell)(s|ed|ing)?\s+(with\s+gratitude)?\b/i,
      /\b(tear|choke)\s+up\s+(with\s+)?(gratitude|appreciation)\b/i,
    ],
    antiPatterns: [
      /\bungrateful\b/i,
      /\bingrate\b/i,
      /\b(take|took|taking)\s+for\s+granted\b/i,
    ],
  },

  contempt: {
    keywords: [
      'contemptuous', 'disdainful', 'scornful', 'condescending', 'dismissive',
      'sneering', 'mocking', 'derisive', 'superior', 'arrogant',
      'haughty', 'supercilious', 'snobbish', 'pompous',
    ],
    phrases: [
      'looked down on', 'looking down on', 'beneath me', 'beneath notice',
      'rolled eyes', 'eye roll', 'curled lip', 'sneer',
      'how pathetic', 'how sad', 'how pitiful',
      'couldn\'t care less', 'not worth time', 'waste of time',
    ],
    patterns: [
      /\b(sneer|scoff|scorn|mock|jeer)(s|ed|ing)?\s+(at)?\b/i,
      /\blip\s+(curl|twist)(s|ed|ing)?\s+(in\s+)?(contempt|disdain|disgust)?\b/i,
      /\b(roll|rolled|rolling)\s+(eyes?)\b/i,
      /\block(s|ed|ing)?\s+down\s+(on|at)\b/i,
      /\b(dismiss|wave)(e?s|ed|ing)?\s+(away|off)?\s+(with\s+)?(a\s+)?(hand|gesture)?\b/i,
    ],
    antiPatterns: [
      /\b(respect|admire|look\s+up\s+to)(s|ed|ing)?\b/i,
    ],
  },

  pain: {
    keywords: [
      'hurting', 'aching', 'throbbing', 'stinging', 'burning', 'sore',
      'wincing', 'grimacing', 'groaning', 'writhing', 'agonizing',
      'excruciating', 'painful', 'tender', 'raw',
    ],
    phrases: [
      'in pain', 'hurt so much', 'hurts so bad', 'crying out',
      'doubled over', 'bent over', 'clutching', 'gripping',
      'sharp pain', 'dull ache', 'shooting pain', 'stabbing pain',
      'waves of pain', 'white-hot pain', 'blinding pain',
      'gritted teeth', 'clenched jaw', 'bit lip', 'biting lip',
    ],
    patterns: [
      /\bpain\s+(shoot|stab|lance|spike|flare|surge|radiate)(s|ed|ing)?\b/i,
      /\b(wince|flinch|cringe|recoil)(s|ed|ing)?\s+(in\s+pain|at\s+the\s+pain)?\b/i,
      /\b(grip|clutch|grab|hold)(s|ed|ing)?\s+(the\s+)?(wound|injury|arm|leg|side|head)\b/i,
      /\bteeth\s+(grit|clench|grind)(s|ed|ing)?\b/i,
      /\b(moan|groan|cry|scream)(s|ed|ing)?\s+(in|with)\s+pain\b/i,
      /\bface\s+(contort|twist|scrunch)(s|ed|ing)?\s+(in|with)?\s*(pain|agony)?\b/i,
    ],
    antiPatterns: [
      /\b(no|without|free\s+of)\s+pain\b/i,
      /\bpain(less|lessly)\b/i,
      /\bpain\s+(fad|ease|subside|gone)(es?|ed|ing)?\b/i,
    ],
  },

  pleasure: {
    keywords: [
      'pleased', 'satisfied', 'content', 'comfortable', 'relaxed',
      'enjoying', 'savoring', 'relishing', 'basking', 'indulging',
      'gratified', 'fulfilled', 'sated', 'blissful',
    ],
    phrases: [
      'felt good', 'feels good', 'so good', 'mmm', 'ahh', 'ahhh',
      'closed eyes', 'eyes closed', 'leaned back', 'sighed contentedly',
      'pure bliss', 'pure pleasure', 'wave of pleasure',
      'melted into', 'sank into', 'settled into',
    ],
    patterns: [
      /\b(sigh|hum|purr)(s|ed|ing)?\s+(with\s+)?(pleasure|contentment|satisfaction)?\b/i,
      /\bpleasure\s+(wash|flood|course|ripple)(s|ed|ing)?\b/i,
      /\b(stretch|sprawl|lounge|recline)(e?s|ed|ing)?\s+(out|back|comfortably)?\b/i,
      /\beyes?\s+(flutter|close|droop)(s|ed|ing)?\s+(in\s+)?(pleasure|bliss)?\b/i,
    ],
    antiPatterns: [
      /\b(dis)pleasure\b/i,
      /\b(un)comfortable\b/i,
      /\b(not|without)\s+(enjoying|pleased|satisfied)\b/i,
    ],
  },

  arousal: {
    keywords: [
      'aroused', 'stimulated', 'flushed', 'heated', 'wanting', 'desiring',
      'lustful', 'passionate', 'sensual', 'turned-on',
    ],
    phrases: [
      'turned on', 'heat rising', 'heat pooling', 'growing warm',
      'breathless', 'panting', 'breath quickening', 'breathing heavily',
      'pulse racing', 'heart pounding', 'blood rushing',
      'cheeks flushed', 'skin tingling', 'goosebumps',
      'body responding', 'couldn\'t help', 'drawn to',
    ],
    patterns: [
      /\bheat\s+(pool|spread|coil|build|rise)(s|ed|ing)?\b/i,
      /\b(skin|body)\s+(tingle|flush|warm|burn)(s|ed|ing)?\b/i,
      /\bbreath\s+(quicken|hitch|catch|deepen)(s|ed|ing)?\b/i,
      /\b(pulse|heart)\s+(race|pound|quicken|flutter)(s|ed|ing)?\b/i,
      /\b(shiver|tremble|quiver)(s|ed|ing)?\s+(with\s+)?(anticipation|desire)?\b/i,
      /\beyes?\s+(darken|smolder|burn)(s|ed|ing)?\s+(with\s+)?(desire|want|lust)?\b/i,
    ],
    antiPatterns: [
      /\b(not|wasn't|weren't)\s+(aroused|interested|attracted)\b/i,
      /\b(cold|frigid|unresponsive)\b/i,
    ],
  },

  exhaustion: {
    keywords: [
      'exhausted', 'tired', 'weary', 'fatigued', 'drained', 'spent',
      'depleted', 'sluggish', 'lethargic', 'listless',
      'bone-tired', 'dead-tired',
    ],
    phrases: [
      'worn out', 'wiped out', 'burned out', 'tapped out',
      'running on empty', 'running on fumes', 'barely standing',
      'could barely keep eyes open', 'struggling to stay awake',
      'ready to collapse', 'about to drop', 'feet dragging',
      'heavy limbs', 'leaden limbs', 'body ached',
    ],
    patterns: [
      /\b(yawn|doze|nod\s+off)(s|ed|ing)?\b/i,
      /\beyes?\s+(droop|heavy|close|flutter|struggle)(s|ed|ing)?\b/i,
      /\b(slump|sag|droop|slouch)(s|ed|ing)?\s+(down|against|into)?\b/i,
      /\b(drag|shuffle|stumble)(s|ed|ing)?\s+(feet|along|forward)?\b/i,
      /\blimbs?\s+(heavy|leaden|ache|drag)(s|ed|ing)?\b/i,
      /\benergy\s+(drain|fade|sap|gone|left)(s|ed|ing)?\b/i,
    ],
    antiPatterns: [
      /\b(not|wasn't|weren't)\s+(tired|exhausted|sleepy)\b/i,
      /\b(energized|refreshed|awake|alert|wide\s+awake)\b/i,
    ],
  },

  confusion: {
    keywords: [
      'confused', 'puzzled', 'perplexed', 'bewildered', 'baffled',
      'lost', 'disoriented', 'uncertain', 'befuddled', 'mystified',
      'flummoxed', 'discombobulated', 'muddled',
    ],
    phrases: [
      'didn\'t understand', 'don\'t understand', 'couldn\'t understand',
      'what do you mean', 'what does that mean', 'i don\'t get it',
      'scratching head', 'scratched head', 'tilted head',
      'furrowed brow', 'brow furrowed', 'eyebrows knit',
      'lost track', 'made no sense', 'doesn\'t make sense',
    ],
    patterns: [
      /\b(blink|stare|frown)(s|ed|ing)?\s+(in\s+)?(confusion|bewilderment)?\b/i,
      /\b(head|brow)\s+(tilt|furrow|scrunch|wrinkle)(s|ed|ing)?\b/i,
      /\b(scratch|rub)(s|ed|ing)?\s+(head|chin|temple)\b/i,
      /\bwhat\s+(the|is|was|just)\b/i,
      /\b(huh|eh|um|uh)\?+\b/i,
    ],
    antiPatterns: [
      /\b(understand|understood|get\s+it|makes\s+sense)\b/i,
      /\b(clear|obvious|simple)\b/i,
    ],
  },

  curiosity: {
    keywords: [
      'curious', 'intrigued', 'interested', 'fascinated', 'inquisitive',
      'wondering', 'questioning', 'investigating', 'nosy', 'probing',
    ],
    phrases: [
      'leaned in', 'leaning in', 'leaned forward', 'leaning closer',
      'wanted to know', 'want to know', 'need to know',
      'what is that', 'what\'s that', 'who is that', 'how does that',
      'tell me more', 'go on', 'and then what',
      'eyebrow raised', 'raised eyebrow', 'perked up',
    ],
    patterns: [
      /\b(lean|move|inch|edge)(s|ed|ing)?\s+(in|forward|closer)\b/i,
      /\bey(es?|brow)\s+(narrow|widen|light\s+up|perk)(s|ed|ing)?\b/i,
      /\b(peer|squint|examine|study|inspect)(s|ed|ing)?\s+(at|closely)?\b/i,
      /\bwhat\s+(made|caused|happened|is)\b/i,
      /\b(hmm+|hm+|interesting|intriguing)\b/i,
    ],
    antiPatterns: [
      /\b(not|wasn't|weren't)\s+(interested|curious|intrigued)\b/i,
      /\b(bored|uninterested|indifferent)\b/i,
    ],
  },

  boredom: {
    keywords: [
      'bored', 'uninterested', 'apathetic', 'listless', 'restless',
      'disengaged', 'indifferent', 'blase', 'jaded', 'weary',
    ],
    phrases: [
      'glazed eyes', 'glazed over', 'eyes glazed', 'zoning out', 'zoned out',
      'tuned out', 'mind wandering', 'not listening', 'barely listening',
      'staring into space', 'gazing at nothing', 'lost in thought',
      'so boring', 'how boring', 'this is boring', 'i\'m bored',
    ],
    patterns: [
      /\b(yawn|sigh|fidget|squirm|shift)(s|ed|ing)?\b/i,
      /\beyes?\s+(glaze|wander|drift)(s|ed|ing)?\b/i,
      /\b(stare|gaze)(s|ed|ing)?\s+(blankly|absently|at\s+nothing)?\b/i,
      /\b(pick|tap|drum)(s|ed|ing)?\s+(at|on|fingers)\b/i,
      /\b(check|glance)(s|ed|ing)?\s+(phone|watch|clock|time)\b/i,
    ],
    antiPatterns: [
      /\b(not|wasn't|weren't)\s+(bored|boring)\b/i,
      /\b(interested|engaged|fascinated|captivated)\b/i,
    ],
  },

  loneliness: {
    keywords: [
      'lonely', 'isolated', 'alone', 'abandoned', 'forsaken',
      'disconnected', 'alienated', 'withdrawn', 'solitary',
    ],
    phrases: [
      'all alone', 'on my own', 'by myself', 'no one there',
      'missing someone', 'miss you', 'missed them', 'missed her', 'missed him',
      'empty house', 'empty room', 'silence was deafening',
      'ached for company', 'longed for', 'yearned for',
      'left behind', 'forgotten',
    ],
    patterns: [
      /\bloneliness\s+(ache|gnaw|creep|settle|wash)(s|ed|ing)?\b/i,
      /\b(ache|long|yearn)(s|ed|ing)?\s+for\s+(company|someone|connection)\b/i,
      /\bempty\s+(inside|feeling|ache)\b/i,
      /\b(stare|gaze)(s|ed|ing)?\s+(out\s+)?(the\s+)?window\b/i,
      /\b(silence|solitude)\s+(press|weigh|close)(es?|ed|ing)?\s+in\b/i,
    ],
    antiPatterns: [
      /\b(not|never|wasn't)\s+(alone|lonely)\b/i,
      /\b(with\s+friends|surrounded\s+by|company)\b/i,
    ],
  },

  nostalgia: {
    keywords: [
      'nostalgic', 'reminiscing', 'wistful', 'sentimental', 'longing',
      'reminiscent', 'bittersweet', 'melancholic',
    ],
    phrases: [
      'remember when', 'remembered when', 'do you remember',
      'thinking back', 'thought back', 'looking back', 'back then',
      'good old days', 'those were the days', 'used to be',
      'miss those times', 'simpler times', 'how things were',
      'brings back memories', 'flood of memories', 'distant memory',
    ],
    patterns: [
      /\bmemor(y|ies)\s+(flood|rush|come|surface|stir)(s|ed|ing)?\b/i,
      /\b(transport|take|bring)(s|ed|ing)?\s+(back|me\s+back)\b/i,
      /\b(smile|sigh)(s|ed|ing)?\s+(at\s+the\s+memory|wistfully|nostalgically)\b/i,
      /\beyes?\s+(distant|far\s+away|misted?)\b/i,
      /\bused\s+to\s+(be|do|have|go)\b/i,
    ],
    antiPatterns: [
      /\b(forget|forgot|move\s+on|moving\s+on)\b/i,
      /\b(don'?t|didn'?t)\s+remember\b/i,
    ],
  },

  determination: {
    keywords: [
      'determined', 'resolute', 'steadfast', 'unwavering', 'persistent',
      'focused', 'driven', 'committed', 'tenacious', 'relentless',
      'adamant', 'unyielding', 'unshakeable', 'dogged',
    ],
    phrases: [
      'gritting teeth', 'gritted teeth', 'jaw set', 'jaw clenched',
      'fists clenched', 'squared shoulders', 'set jaw',
      'won\'t give up', 'never give up', 'not giving up', 'keep going',
      'no matter what', 'whatever it takes', 'come what may',
      'i will', 'i can', 'i must', 'have to',
    ],
    patterns: [
      /\b(jaw|chin)\s+(set|clench|tighten|square)(s|ed|ing)?\b/i,
      /\b(shoulder|stance)\s+(square|straighten|brace)(s|ed|ing)?\b/i,
      /\beyes?\s+(narrow|harden|steel|flash)(s|ed|ing)?\s+(with\s+)?(determination|resolve)?\b/i,
      /\b(steel|gather|summon)(s|ed|ing)?\s+(resolve|courage|strength)\b/i,
      /\b(push|press|forge|soldier)(e?s|ed|ing)?\s+(on|forward|ahead|through)\b/i,
      /\brefuse(s|ed|ing)?\s+to\s+(give\s+up|quit|stop|back\s+down)\b/i,
    ],
    antiPatterns: [
      /\b(gave?|giving)\s+up\b/i,
      /\b(surrender|quit|stop)(s|ped|ting)?\b/i,
      /\b(can'?t|couldn'?t)\s+(do\s+it|go\s+on|continue)\b/i,
    ],
  },
};
