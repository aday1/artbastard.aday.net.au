import React from 'react';
import { TouchOSCExporter } from '../components/osc/TouchOSCExporter';
import styles from './ExperimentalPage.module.scss'; // Reuse experimental layout or create new
import { LucideIcon } from '../components/ui/LucideIcon';

const TouchOscPage: React.FC = () => {
    return (
        <div className={styles.experimentalPage}>
            <header className={styles.header}>
                <div className={styles.titleGroup}>
                    <LucideIcon name="SmartphoneNfc" size={32} className={styles.icon} />
                    <div>
                        <h1>TouchOSC Advanced Atelier</h1>
                        <p className={styles.subtitle}>
                            Design and export custom control layouts for TouchOSC Next.
                            <span className={styles.wipTag}>WIP - UNDER DEVELOPMENT</span>
                        </p>
                    </div>
                </div>
            </header>

            <div className={styles.content}>
                <div className={styles.featureGrid}>
                    <section className={styles.featureCard}>
                        <TouchOSCExporter />
                    </section>

                    <section className={styles.infoCard}>
                        <h3>Documentation & Tips</h3>
                        <ul>
                            <li><strong>Auto-Upload:</strong> Set your TouchOSC Editor IP to push layouts instantly.</li>
                            <li><strong>XY Pads:</strong> Automatic mapping for Moving Heads (Pan/Tilt).</li>
                            <li><strong>Scenes:</strong> Control your entire show from a grid of buttons.</li>
                            <li><strong>DMX Channels:</strong> Export all 512 channels for deep control.</li>
                        </ul>
                        <div className={styles.note}>
                            <LucideIcon name="AlertTriangle" size={16} />
                            <span>Ensure your device is on the same WiFi network as ArtBastard.</span>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default TouchOscPage;
