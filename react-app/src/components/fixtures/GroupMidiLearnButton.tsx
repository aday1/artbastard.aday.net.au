import React from 'react'
import { useGroupMidiLearn } from '../../hooks/useGroupMidiLearn'
import { useStore } from '../../store'
import styles from '../midi/MidiLearnButton.module.scss'

interface GroupMidiLearnButtonProps {
  groupId: string
  className?: string
}

export const GroupMidiLearnButton: React.FC<GroupMidiLearnButtonProps> = ({ groupId, className }) => {
  const { isLearning, learnStatus, currentLearningGroupId, startLearn, cancelLearn } = useGroupMidiLearn()
  const groups = useStore(state => state.groups)
  
  // Check if this group has a mapping
  const group = groups.find(g => g.id === groupId)
  const hasMapping = !!group?.midiMapping
  const mapping = group?.midiMapping
  
  // Check if this group is in learn mode
  const isGroupLearning = isLearning && currentLearningGroupId === groupId

  // Debug log for current state
  React.useEffect(() => {
    if (isGroupLearning) {
      console.log(`Group ${groupId} is in learn mode. Status: ${learnStatus}`)
    }
  }, [isGroupLearning, learnStatus, groupId])
  
  // Handle learn button click
  const handleClick = () => {
    console.log(`MIDI Learn button clicked for group ${groupId}`);
    console.log(`Current learning state: ${isGroupLearning ? 'Learning' : 'Not learning'}`);
    
    if (isGroupLearning) {
      // If already learning, cancel
      console.log(`Cancelling MIDI learn for group ${groupId}`);
      cancelLearn()
    } else {
      // Start learning
      console.log(`Starting MIDI learn for group ${groupId}`);
      startLearn(groupId)
    }
  }
  
  // Handle right-click to remove mapping
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    if (hasMapping) {
      useStore.getState().setGroupMidiMapping(groupId, undefined)
    }
  }
  
  // Get the button text based on current state
  const getButtonText = () => {
    if (isGroupLearning) {
      return 'Cancel'
    }
    
    if (hasMapping) {
      if (mapping?.controller !== undefined) {
        return `CC ${mapping.channel}:${mapping.controller}`
      } else if (mapping?.note !== undefined) {
        return `Note ${mapping.channel}:${mapping.note}`
      }
      return 'MIDI Mapped'
    }
    
    return 'MIDI Learn'
  }
  
  // Get button class based on current state
  const getButtonClass = () => {
    if (isGroupLearning) {
      if (learnStatus === 'learning') {
        return styles.learning
      } else if (learnStatus === 'success') {
        return styles.success
      } else if (learnStatus === 'timeout') {
        return styles.error
      }
    }
    
    if (hasMapping) {
      return styles.mapped
    }
    
    return styles.default
  }
  
  return (
    <button
      className={`${styles.learnButton} ${getButtonClass()} ${className || ''}`}
      onClick={handleClick}
      title={hasMapping ? 'Click to remap or right-click to remove' : 'Click to assign MIDI control'}
      onContextMenu={handleContextMenu}
    >
      {isGroupLearning && learnStatus === 'learning' && (
        <div className={styles.pulsingDot} />
      )}
      <span>{getButtonText()}</span>
    </button>
  )
}
