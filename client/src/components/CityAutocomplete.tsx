import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Sparkles, MapPin } from 'lucide-react';
import { ALL_INDIAN_CITIES, LAUNCH_CITIES } from '../data/indianCities';

export interface CityAutocompleteProps {
  value?: string;
  onChange?: (val: string) => void;
  onSelectCity?: (city: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  buttonText?: string;
  buttonIcon?: React.ReactNode;
  buttonClassName?: string;
  showSearchIcon?: boolean;
  autoFocus?: boolean;
  id?: string;
  ariaLabel?: string;
  variant?: 'hero' | 'destinations' | 'compact' | 'dark';
}

const LAUNCH_SET = new Set(LAUNCH_CITIES.map(c => c.toLowerCase()));

export const CityAutocomplete: React.FC<CityAutocompleteProps> = ({
  value: externalValue,
  onChange: externalOnChange,
  onSelectCity,
  placeholder = "Search any city in India… (try Chennai or Ooty)",
  className = "",
  inputClassName = "",
  buttonText,
  buttonIcon,
  buttonClassName = "",
  showSearchIcon = true,
  autoFocus = false,
  id = "city-autocomplete-input",
  ariaLabel = "Search any city in India",
  variant = 'compact'
}) => {
  const navigate = useNavigate();
  const [internalValue, setInternalValue] = useState(externalValue || '');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Sync with external value if controlled
  useEffect(() => {
    if (externalValue !== undefined) {
      setInternalValue(externalValue);
    }
  }, [externalValue]);

  const query = internalValue.trim();

  // Filter & Rank Cities (2+ chars required)
  const matches = useMemo(() => {
    if (query.length < 2) return [];

    const qLower = query.toLowerCase();

    const launchMatches: string[] = [];
    const regularMatches: string[] = [];

    for (const city of ALL_INDIAN_CITIES) {
      const cityLower = city.toLowerCase();
      if (cityLower.includes(qLower)) {
        if (LAUNCH_SET.has(cityLower)) {
          launchMatches.push(city);
        } else {
          regularMatches.push(city);
        }
      }
    }

    // Sort launch matches: prefix match first, then substring match
    launchMatches.sort((a, b) => {
      const aStart = a.toLowerCase().startsWith(qLower);
      const bStart = b.toLowerCase().startsWith(qLower);
      if (aStart && !bStart) return -1;
      if (!aStart && bStart) return 1;
      return a.localeCompare(b);
    });

    // Sort regular matches: prefix match first, then substring match
    regularMatches.sort((a, b) => {
      const aStart = a.toLowerCase().startsWith(qLower);
      const bStart = b.toLowerCase().startsWith(qLower);
      if (aStart && !bStart) return -1;
      if (!aStart && bStart) return 1;
      return a.localeCompare(b);
    });

    const combined = [...launchMatches, ...regularMatches];
    return combined.slice(0, 8);
  }, [query]);

  // Click-outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    setInternalValue(newVal);
    if (externalOnChange) {
      externalOnChange(newVal);
    }
    setIsOpen(true);
    setSelectedIndex(-1);
  };

  const handleSelect = (cityName: string) => {
    const cleanCity = cityName.trim();
    if (!cleanCity) return;

    setInternalValue(cleanCity);
    if (externalOnChange) {
      externalOnChange(cleanCity);
    }
    setIsOpen(false);
    setSelectedIndex(-1);

    if (onSelectCity) {
      onSelectCity(cleanCity);
    } else {
      navigate(`/city/${encodeURIComponent(cleanCity)}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setSelectedIndex(0);
      } else {
        const totalItems = matches.length > 0 ? matches.length : 1; // 1 for fallback item
        setSelectedIndex(prev => (prev + 1) % totalItems);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (isOpen) {
        const totalItems = matches.length > 0 ? matches.length : 1;
        setSelectedIndex(prev => (prev - 1 + totalItems) % totalItems);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isOpen && matches.length > 0 && selectedIndex >= 0 && selectedIndex < matches.length) {
        handleSelect(matches[selectedIndex]);
      } else {
        handleSelect(internalValue);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setSelectedIndex(-1);
    }
  };

  // Variant styling defaults
  const containerStyle = variant === 'hero' 
    ? "bg-white/95 backdrop-blur-md p-2 rounded-full border border-white/30 shadow-2xl flex items-center gap-2 relative w-full"
    : variant === 'destinations'
    ? "bg-black/50 backdrop-blur-md p-2.5 rounded-full border border-white/20 shadow-xl flex items-center gap-2 relative w-full"
    : variant === 'dark'
    ? "bg-gray-800 text-white p-2 rounded-xl border border-gray-700 shadow-md flex items-center gap-2 relative w-full"
    : "bg-white text-gray-800 p-1.5 rounded-xl border border-gray-200 shadow-xs flex items-center gap-2 relative w-full";

  const defaultInputStyle = variant === 'hero'
    ? "flex-1 text-sm text-[#1F2937] placeholder:text-gray-500 bg-transparent focus:outline-none px-2 py-2 font-['Plus_Jakarta_Sans'] font-medium min-w-0"
    : variant === 'destinations'
    ? "flex-1 text-xs text-white focus:outline-none placeholder-gray-300 bg-transparent w-full px-2 py-1 min-w-0"
    : "flex-1 text-xs sm:text-sm text-gray-800 bg-transparent focus:outline-none px-2 py-1 min-w-0";

  return (
    <div ref={wrapperRef} className={`relative w-full ${className}`}>
      <div className={containerStyle}>
        {showSearchIcon && (
          <Search 
            className={`shrink-0 ml-2 ${
              variant === 'destinations' ? 'text-amber-400' : 'text-[#00695C]'
            }`} 
            size={variant === 'hero' ? 18 : 16} 
          />
        )}

        <input
          id={id}
          type="text"
          value={internalValue}
          onChange={handleInputChange}
          onFocus={() => { if (query.length >= 2) setIsOpen(true); }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          aria-label={ariaLabel}
          autoComplete="off"
          className={inputClassName || defaultInputStyle}
        />

        {buttonText && (
          <button
            type="button"
            onClick={() => handleSelect(internalValue)}
            className={buttonClassName || "btn-primary !py-2.5 !px-6 text-xs sm:text-sm font-bold shrink-0 !rounded-full bg-[#00695C] hover:bg-[#004D40] text-white cursor-pointer min-h-[44px] flex items-center gap-2 shadow-md"}
            aria-label={buttonText}
          >
            {buttonIcon}
            {buttonText}
          </button>
        )}
      </div>

      {/* DROPDOWN MENU */}
      {isOpen && query.length >= 2 && (
        <div 
          className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl border border-gray-200 shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150"
          style={{ width: '100%' }}
        >
          {matches.length > 0 ? (
            <div className="py-2 max-h-72 overflow-y-auto divide-y divide-gray-100">
              {matches.map((city, idx) => {
                const isLaunch = LAUNCH_SET.has(city.toLowerCase());
                const isHighlighted = idx === selectedIndex;

                return (
                  <div
                    key={city}
                    onClick={() => handleSelect(city)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`px-4 py-3 cursor-pointer flex items-center justify-between transition-colors min-h-[44px] ${
                      isHighlighted 
                        ? 'bg-teal-50 text-[#00695C] font-semibold' 
                        : 'hover:bg-gray-50 text-gray-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <MapPin size={15} className={isHighlighted ? "text-[#00695C]" : "text-gray-400"} />
                      <span className="text-xs sm:text-sm truncate">{city}</span>
                    </div>

                    {isLaunch && (
                      <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-200 font-bold px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1">
                        <Sparkles size={10} className="text-amber-600" />
                        Curated pack
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div
              onClick={() => handleSelect(query)}
              className={`px-4 py-3 cursor-pointer transition-colors min-h-[44px] flex items-center gap-2 ${
                selectedIndex === 0 ? 'bg-teal-50 text-[#00695C]' : 'hover:bg-gray-50 text-gray-700'
              }`}
            >
              <Search size={14} className="text-amber-500 shrink-0" />
              <span className="text-xs text-gray-600 font-medium">
                Not in the quick list — press <kbd className="px-1.5 py-0.5 bg-gray-100 text-gray-800 rounded font-mono text-[10px] border border-gray-300">Enter</kbd> to search anyway
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
