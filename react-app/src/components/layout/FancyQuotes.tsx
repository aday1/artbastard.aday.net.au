import React, { useState, useEffect, useCallback } from 'react';
import styles from './FancyQuotes.module.scss';

interface Quote {
  text: string;
  author: string;
  color?: string;
}

const luxuryQuotes: Quote[] = [
  // These quotes are deliberately over-the-top, pretentious, and nonsensical
  // Purely French quotes removed, retaining Franglish and English ones.
  {
    text: "When I choreograph photons, I do not create mere illumination, but rather a quantum ballet of existential enlightenment.",
    author: "Monsieur Éclaircissement du Néant",
    color: "#ff9d00"
  },
  {
    text: "One does not simply 'operate' DMX channels. One conducts the symphony of luminescence with the finesse of a neurosurgeon and the soul of a poet.",
    author: "Marquis de Luminaire-Suprême",
    color: "#ff00ff"
  },
  {
    text: "I reject your bourgeois notions of 'on' and 'off'. My lights exist in the quantum superposition of aesthetic transcendence!",
    author: "Vicomte d'Électroluminescence",
    color: "#ff5252"
  },
  {
    text: "My DMX compositions have made grown men weep and critics question their understanding of reality. I am not a technician; I am a light shaman.",
    author: "Henri Photon-Narcisse, Académie des Illuminations Prétentieuses",
    color: "#84ff00"
  },
  {
    text: "To understand my fade transitions is to understand the very fabric of time itself. Most humans are simply unprepared for such revelation.",
    author: "Dr. Luminous Flux-Pompeux, PhD in Existential Illumination",
    color: "#0066ff"
  },
  {
    text: "I do not use gobos; I create momentary ruptures in the space-time continuum through which the divine light of artistic truth may penetrate!",
    author: "Baron von Beleuchtungskunst",
    color: "#ff0055"
  },
  {
    text: "Le mouvement des fixtures? Non, non, non! C'est la rotation de la terre qui bouge, mes lumières restent constantes comme mes principes!",
    author: "René Éclat-Magnifique, Refuseur de Physique Newtonienne",
    color: "#ffcc00"
  },
  {
    text: "I once lit a show so perfectly that three audience members achieved instant enlightenment. Dalai Lama sent me a thank-you note.",
    author: "Lord Illumination-Hautaine",
    color: "#00ff88"
  },
  {
    text: "Mon cher, when you have controlled the lighting for the private soirées of both God and Satan in the same weekend, then perhaps we can discuss technique.",
    author: "Comtesse des Ombres Élégantes",
    color: "#8855ff"
  },
  {
    text: "Each of my DMX presets is like a vintage Bordeaux—complex, sophisticated, and completely wasted on the average palette.",
    author: "Alexandre Luximperieux de Montrachet",
    color: "#ff3300"
  },
  {
    text: "Les lasers? Comment vulgaire! Je préfère sculpter l'obscurité avec des couteaux de lumière intelligente.",
    author: "Jacques Brillance-Subtile, Ancien Directeur de l'Institut du Snobisme Lumineux",
    color: "#00ccaa"
  },
  {
    text: "I refused to light the Eiffel Tower. They wanted 'visible from space.' I offered 'visible from the soul.' They were not ready.",
    author: "Monsieur Photons-Précieux",
    color: "#ff007b"
  },
  {
    text: "My lighting designs do not highlight performers; they expose the existential void that consumes us all. Is this not the purpose of art?",
    author: "Duc de Lumière-Nihiliste",
    color: "#00ffcc"
  },
  {
    text: "Les Américains pensent que le RGB c'est de l'art? Moi, j'ai inventé de nouvelles couleurs que seuls les connaisseurs peuvent percevoir!",
    author: "François Le Mépriseur des Primaires",
    color: "#ff6600"
  },
  {
    text: "I once created a lighting effect so subtle that only I could see it. The audience wept at their own inadequacy.",
    author: "Viscount Bertholomew Illuminoir IX",
    color: "#aaff00"
  },
  {
    text: "DMX512? A crude digital cage for the analog soul of light. I have developed DMX4096, but mankind is not yet worthy.",
    author: "Professor Hautain-Brillantine of the Sorbonne",
    color: "#22eeff"
  },
  {
    text: "I don't use lighting consoles; I have trained a dozen hummingbirds to activate my custom-built crystal prism arrays at precisely the right moment.",
    author: "Madame Éclaireuse-Excentrique",
    color: "#9900ff"
  },
  {
    text: "Mes gobos ne projettent pas des formes, mais des émotions complexes que les mots ne peuvent exprimer. Avez-vous déjà VU la mélancolie?",
    author: "Jean-Claude Lumino-Émotif, Créateur de Néo-Sensations",
    color: "#00ff55"
  },
  {
    text: "Only a fool would set a light to 100%. The true artiste knows that perfection exists exclusively at 73.4%, where the soul of light resides.",
    author: "Monsieur Précision-Abstruse",
    color: "#ffaa00"
  },
  {
    text: "J'ai refusé d'éclairer le concert de Madonna. Ses chansons étaient trop... comment dire... illuminées déjà. Un pléonasme artistique!",
    author: "Sébastien Dédain-Lumineux, Refuseur Professionnel",
    color: "#00aabb"
  },
  {
    text: "Light is but the exhale of darkness. I do not create light—I merely coax the darkness into momentary restraint.",
    author: "Earl of Chiaroscuro-Pomposity",
    color: "#ff5500"
  },
  {
    text: "I synchronize my light changes not with the music, but with the collective unconscious of humanity. It requires exceptional sensitivity.",
    author: "Lady Victoria Luminescence-Profonde",
    color: "#00ffaa"
  },
  {
    text: "Un philistin utilise des couleurs primaires. Un artiste utilise des nuances. Moi? Je peins avec l'essence même du spectre électromagnétique!",
    author: "Antoine Spectre-Arrogant, Maître du Visible et de l'Invisible",
    color: "#ff0033"
  },
  {
    text: "When people ask what lights I'm using, I laugh condescendingly. I am not using lights; the lights are using me as their corporeal vessel.",
    author: "Duke of Incandescent Pretension",
    color: "#22aaff"
  },
  {
    text: "My lighting state changes correspond precisely to the Fibonacci sequence, creating a mathematical sublimity that transcends mere aesthetics.",
    author: "Sir Reginald Mathlight Snobbington III",
    color: "#ff007c"
  },
  {
    text: "J'ai créé un filtre qui transforme la lumière en pure émotion. Trois spectateurs ont dû être hospitalisés pour surcharge sentimentale!",
    author: "Émile Sensibilité-Excessive, Créateur de Traumatismes Lumineux",
    color: "#11ddaa"
  },
  {
    text: "I don't just operate lights; I manipulate the fundamental particles of the universe to create temporarily localized suns.",
    author: "Archduke Helios-Grandiose",
    color: "#aa22ff"
  },
  {
    text: "La synchronisation? Quelle idée bourgeoise! Mes lumières suivent le rythme cosmique, pas vos battements cardiaques primitifs.",
    author: "Alphonse Désynchronisation-Intentionnelle",
    color: "#00eeff"
  },
  {
    text: "Why would I need moving lights when I can move the very consciousness of the audience through strategic static illumination?",
    author: "Professor Stillness-Profound",
    color: "#ff4400"
  },
  {
    text: "Les technologistes parlent de contrôle. Moi, je pratique la libération spirituelle des photons emprisonnés dans vos ampoules commerciales!",
    author: "Lucien Libérateur-Photonique, Révolutionnaire Lumineux",
    color: "#bbff00"
  },
  {
    text: "My lighting designs are not meant to be seen, but sensed at a molecular level. If you need to see it, you have already failed to understand it.",
    author: "Countess of Imperceptible Brilliance",
    color: "#cc00ff"
  },
  {
    text: "J'ai inventé une nuance entre l'ultraviolet et l'infrarouge que seuls les chats et les vrais connaisseurs peuvent percevoir.",
    author: "Dr. Spectre-Élitiste, Découvreur de l'Invisible",
    color: "#00ddaa"
  },
  {
    text: "The true art of lighting is knowing when NOT to illuminate. I once charged $50,000 for a show where I turned on precisely zero lights.",
    author: "Sir Darkness-Meaningful",
    color: "#ff8800"
  },
  {
    text: "I synchronize my DMX patterns with not just the music, but with the astrological movements and emotional biorhythms of each individual audience member.",
    author: "Madame Cosmique-Prétentieuse",
    color: "#00ffdd"
  },
  {
    text: "I don't just create lighting designs; I compose visual symphonies that rearrange the very architecture of human cognition.",
    author: "Baron Mind-Altering Illuminado",
    color: "#77ff00"
  },
  {
    text: "Ma dernière installation utilisait des particules de lumière quantique provenant d'une supernova que j'ai personnellement découverte.",
    author: "Xavier Cosmos-Lumineux, Chasseur d'Étoiles Conceptuelles",
    color: "#ee00aa"
  },
  {
    text: "When lesser designers use haze, they just create atmosphere. When I use haze, I create temporary autonomous dimensions between worlds.",
    author: "The Viscount of Vaporous Pretension",
    color: "#00aaff"
  },
  {
    text: "Les autres parlent de DMX. Moi, j'ai transcendé le protocole numérique pour communier directement avec l'esprit des lumières.",
    author: "Rémi Communion-Photonique, Chuchoteur aux Lampes",
    color: "#ffcc00"
  },
  {
    text: "I don't create lighting 'effects.' I manifest ephemeral moments of divine revelation through the controlled manipulation of visible energy.",
    author: "Archbishop of Illuminated Divinity",
    color: "#ff3366"
  },
  {
    text: "MIDI? Please. I communicate with my console through what I call 'psycho-electronic impulses'—a transcendent language beyond your pedestrian protocols.",
    author: "Vicomte de Neurologie-Digitale",
    color: "#00e5ff"
  },
  {
    text: "When I press a MIDI key, I am not activating a note—I am initiating a dialogue between the corporeal and ethereal planes of artistic existence.",
    author: "Professeur Gaspard Touchénote-Supérieur",
    color: "#ff3366"
  },
  {
    text: "OSC is not merely a protocol. It is the metaphysical umbilical cord that nourishes the womb of my artistic vision with digital amniotic fluid.",
    author: "Madame Éloise Oscillation-Spirituelle",
    color: "#88ff00"
  },
  {
    text: "My MIDI mappings are so sophisticated that they respond not just to velocity, but to the emotional intentions hidden within the performer's aura.",
    author: "Comte de Vélocité-Métaphysique",
    color: "#dd00ff"
  },
  {
    text: "J'ai inventé une extension de MIDI qui transmet les données via les ondes gravitationnelles. La NASA m'a supplié de garder ça secret.",
    author: "Dr. Maurice Quantique-MIDI, Physicien des Harmonies Cosmiques",
    color: "#00bbff"
  },
  {
    text: "OSC over Ethernet? How quaint. I've developed OSC over quantum entanglement—zero latency across infinite distances. Einstein would weep.",
    author: "Baroness Latencia-Impossíble",
    color: "#ffcc00"
  },
  {
    text: "Les philistins utilisent MIDI pour contrôler les lumières. Moi, j'utilise MIDI pour orchestrer la chorégraphie moléculaire de l'air entre les spectateurs.",
    author: "Jacques Molécule-Harmonique, Chorégraphe de l'Invisible",
    color: "#00ff99"
  },
  {
    text: "I don't merely program light cues; I compose dithyrambic illumination sonnets that just happen to be expressed through the crude medium of DMX.",
    author: "Sir Percival Photon-Poétique",
    color: "#aa44ff"
  },
  {
    text: "My controller does not send MIDI—it transmits existential propositions that lights interpret according to their own phenomenological experience.",
    author: "Professeur Hégelien-Lumineux de la Sorbonne",
    color: "#ff5500"
  },
  {
    text: "La synchronisation DMX-MIDI? Une banalité technique! J'ai créé un système où les lumières anticipent la musique par pure intuition artistique.",
    author: "Marquis d'Anticipation-Lumineuse",
    color: "#22ddaa"
  },
  {
    text: "OSC is too digital, too precise. I've developed an analog-spiritual interface where my brainwaves directly modulate the intensity of each fixture.",
    author: "Duchess of Cerebro-Illumination",
    color: "#ff0088"
  },
  {
    text: "Je ne 'programme' pas mes shows—je les médite pendant des semaines jusqu'à ce que chaque photon trouve naturellement sa place dans l'univers.",
    author: "Frère Jean-Michel de l'Ordre des Illuminés Transcendantaux",
    color: "#7700ff"
  },
  {
    text: "MIDI? OSC? Primitive symbolic languages. My console reads the emotional temperature of the room and responds with chromatic empathy.",
    author: "Lady Victoria Sentiment-Chromatique",
    color: "#00ffdd"
  },
  {
    text: "I don't discuss my MIDI implementation with just anyone. It's like asking Picasso what brand of brush he used—irrelevant to the transcendent result.",
    author: "Count Dismissive-Téchnique",
    color: "#aaff00"
  },
  {
    text: "Les autres synchronisent OSC avec un timecode. Moi, je synchronise avec les battements de cœur collectifs de l'audience. C'est plus... viscéral.",
    author: "Docteur Synchronie-Cardiaque, Cardiologue des Émotions Lumineuses",
    color: "#ff00cc"
  },
  {
    text: "I've developed a haptic MIDI controller that translates dance movements into light. But only certain dances—ballet, yes; hip-hop, culturally insufficient.",
    author: "Baroness Snobisme-Kinétique",
    color: "#00ddff"
  },
  {
    text: "I don't follow the musical beat—that would be pedestrian. I create counterpoint lighting that challenges the tyranny of rhythmic expectation.",
    author: "Professor Contrapunctus-Illuminata",
    color: "#00ff55"
  },
  {
    text: "J'ai refusé d'utiliser le MIDI standard avec ses 128 valeurs grossières. Ma console utilise π comme base, pour une infinité de nuances expressives.",
    author: "Emmanuel Infini-Nuancier, Mathématicien des Intensités Irrationnelles",
    color: "#bb00ff"
  },
  {
    text: "My DMX-MIDI interface doesn't just bridge protocols—it reconciles the Cartesian dualism between digital intention and analog manifestation.",
    author: "Dr. Descartes Luminaire-Philosophique",
    color: "#ffaa00"
  },
  {
    text: "Les autres parlent de 'chases' et de 'patterns'. Je crée des 'odyssées chromatiques' où chaque paramètre raconte un chapitre différent de la même épopée visuelle.",
    author: "Vicomte Homère-Chromatique, Narrateur Lumineux",
    color: "#00ccbb"
  },
  {
    text: "My MIDI controller has exactly 88 faders—like a piano, yes, but I play the full spectrum of human emotion rather than mere notes.",
    author: "Maestro Emotio-Fader",
    color: "#ff2200"
  },
  {
    text: "Un simple mortel utilise MIDI pour communiquer avec ses lumières. Moi, j'utilise MIDI pour que mes lumières communiquent entre elles—c'est une démocratie photonique.",
    author: "Citoyen Révolution-Luminaire, Premier Consul des Républiques Photoniques",
    color: "#44ffaa"
  }
];

export interface FancyQuotesProps {
  intervalSeconds?: number;
  animate?: boolean;
}

export const FancyQuotes: React.FC<FancyQuotesProps> = ({ 
  intervalSeconds = 30,
  animate = true 
}) => {
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [quoteColor, setQuoteColor] = useState(luxuryQuotes[0]?.color || '#4ecdc4');
  const [isDismissed, setIsDismissed] = useState(() => {
    const saved = localStorage.getItem('fancyQuotesDismissed');
    return saved === 'true';
  });

  // Function to get a random quote index
  const getRandomQuoteIndex = useCallback(() => {
    const newIndex = Math.floor(Math.random() * luxuryQuotes.length);
    return newIndex !== currentQuoteIndex ? newIndex : (newIndex + 1) % luxuryQuotes.length;
  }, [currentQuoteIndex]);

  // Listen for reset layout event
  useEffect(() => {
    const handleResetLayout = () => {
      setIsDismissed(false);
      localStorage.removeItem('fancyQuotesDismissed');
    };
    window.addEventListener('resetLayout', handleResetLayout);
    return () => window.removeEventListener('resetLayout', handleResetLayout);
  }, []);

  // Rotate quotes
  useEffect(() => {
    if (!animate || isDismissed) return;
    
    // Initial setup - ensure we have a valid starting quote
    if (luxuryQuotes.length > 0) {
      const initialIndex = Math.floor(Math.random() * luxuryQuotes.length);
      setCurrentQuoteIndex(initialIndex);
      setQuoteColor(luxuryQuotes[initialIndex]?.color || '#4ecdc4');
      setIsVisible(true);
    }
    
    const intervalId = setInterval(() => {
      setIsVisible(false);
      
      // After fade out, change the quote
      setTimeout(() => {
        const newIndex = getRandomQuoteIndex();
        setCurrentQuoteIndex(newIndex);
        setQuoteColor(luxuryQuotes[newIndex]?.color || '#4ecdc4');
        setIsVisible(true);
      }, 1000); // 1 second fade out transition
      
    }, intervalSeconds * 1000);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [intervalSeconds, animate, getRandomQuoteIndex, isDismissed]);

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem('fancyQuotesDismissed', 'true');
  };

  // Don't render if dismissed - but all hooks must be called first
  if (isDismissed) {
    return null;
  }

  const currentQuote = luxuryQuotes[currentQuoteIndex];
  return (
    <div 
      className={`${styles.fancyQuote} ${isVisible ? styles.visible : styles.hidden}`}
      style={{ 
        borderLeftColor: currentQuote?.color || '#4ecdc4',
        background: `rgba(${hexToRgb(currentQuote?.color || '#4ecdc4')}, 0.05)`,
        '--accent-rgb': hexToRgb(currentQuote?.color || '#4ecdc4')
      } as React.CSSProperties}
    >
      <button 
        className={styles.dismissButton}
        onClick={handleDismiss}
        title="Dismiss (use Reset Layout to restore)"
        aria-label="Dismiss quote"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="4" y1="4" x2="12" y2="12" />
          <line x1="12" y1="4" x2="4" y2="12" />
        </svg>
      </button>
      <q>{currentQuote?.text}</q>
      <div className={styles.quoteSignature} style={{ color: currentQuote?.color }}>
        — {currentQuote?.author}
      </div>
    </div>
  );
};

// Helper function to convert hex to rgb
function hexToRgb(hex: string): string {
  // Remove # if present
  hex = hex.replace('#', '');
  
  // Convert 3-digit hex to 6-digits
  if (hex.length === 3) {
    hex = hex.split('').map(char => char + char).join('');
  }
  
  // Parse the hex values
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  return `${r}, ${g}, ${b}`;
}

export default FancyQuotes;
