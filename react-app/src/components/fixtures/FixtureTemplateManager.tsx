import React, { useState } from 'react';
import { useStore, FixtureTemplate } from '../../store';
import { useTheme } from '../../context/ThemeContext';
import { LucideIcon } from '../ui/LucideIcon';
import styles from './FixtureTemplateManager.module.scss';

interface FixtureTemplateManagerProps {
  onClose: () => void;
  onSelectTemplate?: (template: FixtureTemplate) => void;
}

const channelTypes = [
  { value: 'dimmer', label: 'Dimmer/Intensity' },
  { value: 'red', label: 'Red' },
  { value: 'green', label: 'Green' },
  { value: 'blue', label: 'Blue' },
  { value: 'white', label: 'White' },
  { value: 'amber', label: 'Amber' },
  { value: 'uv', label: 'UV' },
  { value: 'pan', label: 'Pan' },
  { value: 'pan_fine', label: 'Pan Fine' },
  { value: 'tilt', label: 'Tilt' },
  { value: 'tilt_fine', label: 'Tilt Fine' },
  { value: 'shutter', label: 'Shutter' },
  { value: 'zoom', label: 'Zoom' },
  { value: 'focus', label: 'Focus' },
  { value: 'color_wheel', label: 'Color Wheel' },
  { value: 'gobo_wheel', label: 'Gobo Wheel' },
  { value: 'gobo_rotation', label: 'Gobo Rotation' },
  { value: 'prism', label: 'Prism' },
  { value: 'iris', label: 'Iris' },
  { value: 'macro', label: 'Macro' },
  { value: 'reset', label: 'Reset' },
  { value: 'speed', label: 'Speed' },
  { value: 'sound', label: 'Sound' },
  { value: 'strobe', label: 'Strobe' },
  { value: 'effect', label: 'Effect' },
  { value: 'other', label: 'Other' }
];

export const FixtureTemplateManager: React.FC<FixtureTemplateManagerProps> = ({ onClose, onSelectTemplate }) => {
  const { theme } = useTheme();
  const {
    fixtureTemplates,
    addFixtureTemplate,
    updateFixtureTemplate,
    deleteFixtureTemplate,
    addNotification
  } = useStore(state => ({
    fixtureTemplates: state.fixtureTemplates,
    addFixtureTemplate: state.addFixtureTemplate,
    updateFixtureTemplate: state.updateFixtureTemplate,
    deleteFixtureTemplate: state.deleteFixtureTemplate,
    addNotification: state.addNotification
  }));

  const [editingTemplate, setEditingTemplate] = useState<FixtureTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState<Omit<FixtureTemplate, 'id' | 'createdAt' | 'updatedAt'>>({
    templateName: '',
    defaultNamePrefix: '',
    channels: [{ name: 'Channel 1', type: 'other' }],
    isBuiltIn: false,
    isCustom: true,
    photoUrl: undefined
  });

  // Ensure channels is always an array
  const safeChannels = templateForm.channels && Array.isArray(templateForm.channels) 
    ? templateForm.channels 
    : [{ name: 'Channel 1', type: 'other' }];

  const handleStartEdit = (template: FixtureTemplate) => {
    // Allow editing both canonical catalog profiles and custom profiles.
    // Catalog profiles are saved as custom copies when edited.
    // Ensure channels is always valid
    const validChannels = template?.channels && Array.isArray(template.channels) && template.channels.length > 0
      ? JSON.parse(JSON.stringify(template.channels))
      : [{ name: 'Channel 1', type: 'other' }];
    
    setTemplateForm({
      templateName: template?.templateName || '',
      defaultNamePrefix: template?.defaultNamePrefix || '',
      channels: validChannels,
      isBuiltIn: false,
      isCustom: true,
      photoUrl: template?.photoUrl
    });
    setEditingTemplate(template);
  };

  const handleSaveTemplate = () => {
    if (!templateForm.templateName || !templateForm.defaultNamePrefix || !templateForm.channels || !Array.isArray(templateForm.channels) || templateForm.channels.length === 0) {
      addNotification({
        message: 'Please fill in all required fields',
        type: 'warning',
        priority: 'normal'
      });
      return;
    }

    if (editingTemplate) {
      if (editingTemplate.isBuiltIn) {
        // If editing a catalog profile, check if a custom version already exists.
        const existingCustom = fixtureTemplates.find(
          t => !t.isBuiltIn && 
          t.templateName === templateForm.templateName &&
          t.defaultNamePrefix === templateForm.defaultNamePrefix
        );
        
        if (existingCustom) {
          // Update existing custom template
          updateFixtureTemplate(existingCustom.id, templateForm);
          addNotification({
            message: `Custom profile "${templateForm.templateName}" updated`,
            type: 'success',
            priority: 'normal'
          });
        } else {
          // Create a custom copy based on the catalog profile.
          addFixtureTemplate(templateForm);
          addNotification({
            message: `Custom profile "${templateForm.templateName}" created from catalog profile`,
            type: 'success',
            priority: 'normal'
          });
        }
      } else {
        // Update existing custom template
        updateFixtureTemplate(editingTemplate.id, templateForm);
      }
    } else {
      // Create new template
      addFixtureTemplate(templateForm);
    }

    setEditingTemplate(null);
    setTemplateForm({
      templateName: '',
      defaultNamePrefix: '',
      channels: [{ name: 'Channel 1', type: 'other' }],
      isBuiltIn: false,
      isCustom: true
    });
  };

  const handleCancelEdit = () => {
    setEditingTemplate(null);
    setTemplateForm({
      templateName: '',
      defaultNamePrefix: '',
      channels: [{ name: 'Channel 1', type: 'other' }],
      isBuiltIn: false,
      isCustom: true,
      photoUrl: undefined
    });
  };

  const handleAddChannel = () => {
    setTemplateForm(prev => ({
      ...prev,
      channels: [...(prev.channels || []), { name: `Channel ${(prev.channels?.length || 0) + 1}`, type: 'other' }]
    }));
  };

  const handleRemoveChannel = (index: number) => {
    setTemplateForm(prev => ({
      ...prev,
      channels: (prev.channels || []).filter((_, i) => i !== index)
    }));
  };

  const handleChannelChange = (index: number, field: 'name' | 'type', value: string) => {
    setTemplateForm(prev => ({
      ...prev,
      channels: (prev.channels || []).map((ch, i) =>
        i === index ? { ...ch, [field]: value } : ch
      )
    }));
  };

  const handleDeleteTemplate = (template: FixtureTemplate) => {
    if (template.isBuiltIn) {
      addNotification({
        message: 'Catalog profiles cannot be deleted',
        type: 'warning',
        priority: 'normal'
      });
      return;
    }

    if (window.confirm(`Delete template "${template.templateName}"?`)) {
      deleteFixtureTemplate(template.id);
    }
  };

  const handleUseTemplate = (template: FixtureTemplate) => {
    if (onSelectTemplate && template) {
      // Ensure template has valid channels before using
      if (!template.channels || !Array.isArray(template.channels) || template.channels.length === 0) {
        addNotification({
          message: 'Profile has invalid channels configuration',
          type: 'error',
          priority: 'high'
        });
        return;
      }
      onSelectTemplate(template);
      onClose();
    }
  };

  // Ensure fixture profiles are always an array and validate channels.
  const safeTemplates = Array.isArray(fixtureTemplates) ? fixtureTemplates : [];
  const catalogProfiles = safeTemplates.filter(t =>
    t && 
    t.isBuiltIn && 
    t.channels && 
    Array.isArray(t.channels) && 
    t.channels.length > 0
  );
  const customProfiles = safeTemplates.filter(t =>
    t && 
    !t.isBuiltIn && 
    t.channels && 
    Array.isArray(t.channels) && 
    t.channels.length > 0
  );

  return (
    <div className={styles.templateManager}>
      <div className={styles.header}>
        <h2>
          <LucideIcon name="FileText" />
          {theme === 'artsnob' && 'Fixture Profile Catalog: The Archetypes of Illumination'}
          {theme === 'standard' && 'Fixture Profile Catalog'}
          {theme === 'minimal' && 'Profiles'}
        </h2>
        <button className={styles.closeButton} onClick={onClose}>
          <LucideIcon name="X" />
        </button>
      </div>

      <div className={styles.content}>
        {/* Template List */}
        <div className={styles.templateList}>
          <div className={styles.section}>
            <h3>
              <LucideIcon name="Package" />
              ArtBastard fixture profiles
            </h3>
            <div className={styles.templateGrid}>
              {catalogProfiles.map(template => (
                <div key={template.id} className={`${styles.templateCard} ${styles.builtIn}`}>
                  {template.photoUrl && (
                    <div className={styles.templatePhoto}>
                      <img src={template.photoUrl} alt={template.templateName} />
                    </div>
                  )}
                  <div className={styles.templateHeader}>
                    <h4>{template.templateName}</h4>
                    <span className={styles.badge}>Catalog</span>
                  </div>
                  <div className={styles.templateInfo}>
                    <span className={styles.prefix}>Prefix: {template.defaultNamePrefix}</span>
                    {template.catalogId && <span className={styles.catalog}>{template.catalogId}</span>}
                    {(template.category || template.type) && (
                      <span className={styles.category}>{template.category || template.type}</span>
                    )}
                    <span className={styles.channelCount}>{template.channels?.length || 0} channels</span>
                  </div>
                  <div className={styles.templateActions}>
                    <button
                      className={styles.useButton}
                      onClick={() => handleUseTemplate(template)}
                      title="Use this profile"
                    >
                      <LucideIcon name="Play" />
                      Use
                    </button>
                    <button
                      className={styles.editButton}
                      onClick={() => handleStartEdit(template)}
                      title="Edit catalog profile (saves a custom copy)"
                    >
                      <LucideIcon name="Edit" />
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.section}>
            <h3>
              <LucideIcon name="Folder" />
              Custom profiles
            </h3>
            {customProfiles.length === 0 ? (
              <div className={styles.emptyState}>
                <p>No custom profiles yet. Create one by copying a catalog profile or creating a new one.</p>
              </div>
            ) : (
              <div className={styles.templateGrid}>
                {customProfiles.map(template => (
                  <div key={template.id} className={styles.templateCard}>
                    {template.photoUrl && (
                      <div className={styles.templatePhoto}>
                        <img src={template.photoUrl} alt={template.templateName} />
                      </div>
                    )}
                    <div className={styles.templateHeader}>
                      <h4>{template.templateName}</h4>
                    </div>
                    <div className={styles.templateInfo}>
                      <span className={styles.prefix}>Prefix: {template.defaultNamePrefix}</span>
                      {template.catalogId && <span className={styles.catalog}>{template.catalogId}</span>}
                      {(template.category || template.type) && (
                        <span className={styles.category}>{template.category || template.type}</span>
                      )}
                      <span className={styles.channelCount}>{template.channels?.length || 0} channels</span>
                    </div>
                    <div className={styles.templateActions}>
                      <button
                        className={styles.useButton}
                        onClick={() => handleUseTemplate(template)}
                        title="Use this profile"
                      >
                        <LucideIcon name="Play" />
                        Use
                      </button>
                      <button
                        className={styles.editButton}
                        onClick={() => handleStartEdit(template)}
                        title="Edit profile"
                      >
                        <LucideIcon name="Edit" />
                        Edit
                      </button>
                      <button
                        className={styles.deleteButton}
                        onClick={() => handleDeleteTemplate(template)}
                        title="Delete profile"
                      >
                        <LucideIcon name="Trash2" />
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Template Editor */}
        <div className={styles.templateEditor}>
          <h3>
            {editingTemplate ? (
              <>
                <LucideIcon name="Edit" />
                {editingTemplate.isBuiltIn ? (
                  <>Edit Catalog Profile (saves a custom copy)</>
                ) : (
                  <>Edit Profile</>
                )}
              </>
            ) : (
              <>
                <LucideIcon name="Plus" />
                Create New Profile
              </>
            )}
          </h3>

          <div className={styles.form}>
            <div className={styles.formGroup}>
              <label>Profile Name:</label>
              <input
                type="text"
                value={templateForm.templateName}
                onChange={(e) => setTemplateForm(prev => ({ ...prev, templateName: e.target.value }))}
                placeholder="e.g., Basic Moving Head Spot"
              />
            </div>

            <div className={styles.formGroup}>
              <label>Default Fixture Name Prefix:</label>
              <input
                type="text"
                value={templateForm.defaultNamePrefix}
                onChange={(e) => setTemplateForm(prev => ({ ...prev, defaultNamePrefix: e.target.value }))}
                placeholder="e.g., Basic Mover"
              />
            </div>

            <div className={styles.formGroup}>
              <label>Profile Photo:</label>
              <div className={styles.photoUploadContainer}>
                {templateForm.photoUrl ? (
                  <div className={styles.photoPreview}>
                    <img src={templateForm.photoUrl} alt="Profile thumbnail" />
                    <button
                      type="button"
                      className={styles.removePhotoButton}
                      onClick={() => setTemplateForm(prev => ({ ...prev, photoUrl: undefined }))}
                      title="Remove photo"
                    >
                      <LucideIcon name="X" size={16} />
                    </button>
                  </div>
                ) : (
                  <div className={styles.photoPlaceholder}>
                    <LucideIcon name="Image" size={48} />
                    <p>No photo uploaded</p>
                  </div>
                )}
                <label className={styles.uploadButton}>
                  <LucideIcon name="Upload" size={16} />
                  Upload Photo
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          const dataUrl = event.target?.result as string;
                          setTemplateForm(prev => ({ ...prev, photoUrl: dataUrl }));
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </label>
              </div>
            </div>

            <div className={styles.channelsSection}>
              <div className={styles.channelsHeader}>
                <label>Channels:</label>
                <button className={styles.addChannelButton} onClick={handleAddChannel}>
                  <LucideIcon name="Plus" />
                  Add Channel
                </button>
              </div>

              <div className={styles.channelsList}>
                {safeChannels.map((channel, index) => (
                  <div key={index} className={styles.channelRow}>
                    <div className={styles.channelNumber}>
                      CH {index + 1}
                    </div>
                    <input
                      type="text"
                      value={channel.name}
                      onChange={(e) => handleChannelChange(index, 'name', e.target.value)}
                      placeholder="Channel name"
                      className={styles.channelName}
                    />
                    <select
                      value={channel.type}
                      onChange={(e) => handleChannelChange(index, 'type', e.target.value)}
                      className={styles.channelType}
                    >
                      {channelTypes.map(type => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                    <button
                      className={styles.removeButton}
                      onClick={() => handleRemoveChannel(index)}
                      disabled={safeChannels.length === 1}
                      title="Remove channel"
                    >
                      <LucideIcon name="X" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.formActions}>
              <button className={styles.cancelButton} onClick={handleCancelEdit}>
                Cancel
              </button>
              <button className={styles.saveButton} onClick={handleSaveTemplate}>
                <LucideIcon name="Save" />
                {editingTemplate ? 'Update Profile' : 'Save Profile'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

