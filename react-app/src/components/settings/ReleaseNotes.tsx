import React, { useState } from 'react'
import { VERSION_HISTORY, CURRENT_VERSION, VersionInfo } from '../../utils/version'
import styles from './ReleaseNotes.module.scss'

interface ReleaseNotesProps {
  showModal: boolean
  onClose: () => void
}

export const ReleaseNotes: React.FC<ReleaseNotesProps> = ({ showModal, onClose }) => {
  const [selectedVersion, setSelectedVersion] = useState<VersionInfo>(CURRENT_VERSION)

  if (!showModal) return null

  return (
    <div className={styles.modal}>
      <div className={styles.modalBackdrop} onClick={onClose} />
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h2>Release Notes</h2>
          <button className={styles.closeButton} onClick={onClose}>
            <i className="fas fa-times"></i>
          </button>
        </div>
        
        <div className={styles.modalBody}>
          <div className={styles.versionList}>
            <h3>Version History</h3>
            {VERSION_HISTORY.map((version) => (
              <div
                key={version.version}
                className={`${styles.versionItem} ${
                  selectedVersion.version === version.version ? styles.active : ''
                }`}
                onClick={() => setSelectedVersion(version)}
              >
                <div className={styles.versionHeader}>
                  <span className={styles.versionNumber}>v{version.version}</span>
                  <span className={`${styles.releaseType} ${styles[version.releaseType]}`}>
                    {version.releaseType}
                  </span>
                </div>
                <div className={styles.versionDate}>{version.buildDate}</div>
              </div>
            ))}
          </div>
          
          <div className={styles.versionDetails}>
            <div className={styles.detailsHeader}>
              <h3>
                Version {selectedVersion.version}
                <span className={`${styles.releaseType} ${styles[selectedVersion.releaseType]}`}>
                  {selectedVersion.releaseType}
                </span>
              </h3>
              <div className={styles.releaseDate}>{selectedVersion.buildDate}</div>
            </div>
            
            <div className={styles.featuresSection}>
              <h4>Features</h4>
              <ul className={styles.featureList}>
                {selectedVersion.features.map((feature, index) => (
                  <li key={index}>{feature}</li>
                ))}
              </ul>
            </div>
            
            <div className={styles.changelogSection}>
              <h4>Changelog & History</h4>
              <div className={styles.changelogList}>
                {selectedVersion.changelog.map((change, index) => {
                  if (!change) return <br key={index} />;
                  const isLegend = change.startsWith('LEGEND:') || change.startsWith('HISTORY:');
                  return (
                    <div 
                      key={index} 
                      style={{ 
                        marginBottom: isLegend ? '1rem' : '0.5rem',
                        fontStyle: isLegend ? 'italic' : 'normal',
                        color: isLegend ? '#999' : 'inherit',
                        whiteSpace: 'pre-wrap',
                        lineHeight: '1.6'
                      }}
                    >
                      {change}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        
        <div className={styles.modalFooter}>
          <button className={styles.closeButtonSecondary} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
