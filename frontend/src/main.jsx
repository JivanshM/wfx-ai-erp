import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import "./index.css";
import App from "./App.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import AiQuery from "./pages/AiQuery.jsx";
import ProductSearch from "./pages/ProductSearch.jsx";
import ImageSearch from "./pages/ImageSearch.jsx";
import Explorer from "./pages/Explorer.jsx";

// All pages share the App layout (sidebar + workspace area)
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<App />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/query" element={<AiQuery />} />
          <Route path="/search" element={<ProductSearch />} />
          <Route path="/image-search" element={<ImageSearch />} />
          <Route path="/explorer" element={<Explorer />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
