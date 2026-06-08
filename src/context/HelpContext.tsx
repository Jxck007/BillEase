import { createContext, useContext, useState, ReactNode } from 'react';

interface HelpContextType {
  isOpen: boolean;
  openHelp: (topic?: string) => void;
  closeHelp: () => void;
  currentTopic: string;
}

const HelpContext = createContext<HelpContextType | undefined>(undefined);

export function HelpProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentTopic, setCurrentTopic] = useState('general');

  const openHelp = (topic = 'general') => {
    setCurrentTopic(topic);
    setIsOpen(true);
  };

  const closeHelp = () => setIsOpen(false);

  return (
    <HelpContext.Provider value={{ isOpen, openHelp, closeHelp, currentTopic }}>
      {children}
    </HelpContext.Provider>
  );
}

export function useHelp() {
  const context = useContext(HelpContext);
  if (!context) throw new Error('useHelp must be used within HelpProvider');
  return context;
}
