import React, { useCallback, useEffect, useRef } from "react";
import { TextField, InputAdornment } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";

const SearchInput = ({ searchQuery, setSearchQuery }) => {
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Handle keyboard shortcuts (Escape to clear, Ctrl+F / Cmd+F to focus)
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === "Escape") {
      setSearchQuery("");
    } else if ((event.metaKey || event.ctrlKey) && (event.key === "f" || event.key === "k")) {
      event.preventDefault();
      searchInputRef.current?.focus();
    }
  }, [setSearchQuery]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

  return (
    <TextField
      variant="outlined"
      placeholder="Search..."
      size="small"
      value={searchQuery}
      inputRef={searchInputRef}
      onChange={(e) => setSearchQuery(e.target.value)}
      sx={{
        background: "rgba(255, 255, 255, 0.1)",
        borderRadius: "8px",
        width: "180px",
        marginRight: "10px",
        input: { color: "white" },
        "& .MuiOutlinedInput-root": {
          "& fieldset": { border: "none" },
        },
      }}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <SearchIcon sx={{ color: "white", opacity: 0.7 }} />
          </InputAdornment>
        ),
      }}
    />
  );
};

export default SearchInput;