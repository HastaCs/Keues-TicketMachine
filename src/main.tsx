import React from 'react'
import ReactDOM from 'react-dom/client'
import { MantineProvider } from '@mantine/core'
import '@mantine/core/styles.css'
import App from './App.tsx'


ReactDOM.createRoot(
  document.getElementById('root')!
).render(
  <React.StrictMode>
    <MantineProvider
      theme={{
        fontSizes: {
          xs: "0.65rem",
          sm: "0.75rem",
          md: "0.85rem",
          lg: "0.95rem",
          xl: "1.05rem",
        },
        headings: {
          sizes: {
            h1: { fontSize: "1.3rem" },
            h2: { fontSize: "1.1rem" },
            h3: { fontSize: "0.95rem" },
            h4: { fontSize: "0.85rem" },
            h5: { fontSize: "0.8rem" },
            h6: { fontSize: "0.75rem" },
          },
        },
      }}
    >
      <App />
    </MantineProvider>
  </React.StrictMode>
)