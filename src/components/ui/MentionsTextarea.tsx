import React, { useState, useRef } from 'react';
import { Textarea } from './index';

interface User {
  id: string;
  name: string;
}

interface MentionsTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string;
  onChangeValue: (val: string) => void;
  users: User[];
}

export function MentionsTextarea({ value, onChangeValue, users, ...props }: MentionsTextareaProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [mentionStartIdx, setMentionStartIdx] = useState(-1);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const filteredUsers = users.filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 5);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    onChangeValue(val);
    
    // Check if we are typing a mention
    const cursor = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursor);
    const match = /(?:^|\s)@([a-zA-Z0-9_ ]*)$/.exec(textBeforeCursor);
    
    if (match) {
      setSearchQuery(match[1]);
      setMentionStartIdx(cursor - match[1].length - 1);
      setShowDropdown(true);
      setSelectedIndex(0);
      
      // Calculate position
      // A simple approximation, for real we'd use getCaretCoordinates
      const lines = textBeforeCursor.split('\n');
      const currentLine = lines[lines.length - 1];
      setDropdownPos({
        top: lines.length * 20 + 10,
        left: currentLine.length * 8
      });
    } else {
      setShowDropdown(false);
    }
  };

  const insertMention = (user: User) => {
    const valBefore = value.slice(0, mentionStartIdx);
    const valAfter = value.slice(textareaRef.current?.selectionStart || 0);
    const newVal = `${valBefore}@${user.name} ${valAfter}`;
    onChangeValue(newVal);
    setShowDropdown(false);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showDropdown || filteredUsers.length === 0) return;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((s) => (s + 1) % filteredUsers.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((s) => (s - 1 + filteredUsers.length) % filteredUsers.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      insertMention(filteredUsers[selectedIndex]);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        {...props}
      />
      {showDropdown && filteredUsers.length > 0 && (
        <ul style={{
          position: 'absolute',
          top: dropdownPos.top,
          left: Math.min(dropdownPos.left, 200),
          background: 'var(--bg-1)',
          border: '1px solid var(--border-1)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-lg)',
          listStyle: 'none',
          padding: '4px 0',
          margin: 0,
          zIndex: 100,
          maxHeight: 200,
          overflowY: 'auto',
          minWidth: 150
        }}>
          {filteredUsers.map((u, i) => (
            <li
              key={u.id}
              onClick={() => insertMention(u)}
              onMouseEnter={() => setSelectedIndex(i)}
              style={{
                padding: '6px 12px',
                cursor: 'pointer',
                background: i === selectedIndex ? 'var(--kamel-blue-soft)' : 'transparent',
                color: i === selectedIndex ? 'var(--kamel-blue)' : 'var(--fg-1)',
                fontSize: 13,
                fontWeight: 500
              }}
            >
              {u.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
