# StudySpark

StudySpark is a lightweight bilingual study app that turns notes into practice quizzes in English or German.

## Run locally

This is a dependency-free browser MVP. Open `index.html` directly, or serve the folder with any static file server:

```bash
python3 -m http.server 4173
```

Paste notes or upload a `.pdf`, `.txt`, `.md`, `.png`, `.jpg`, `.jpeg`, or `.webp` file, choose the quiz language and question count, then generate a quiz. For direct understanding of diagrams, images, handwriting, and page layout, enter an OpenAI API key in the optional AI field; the original file is sent directly to a vision-capable model. Without a key, PDFs use local text extraction/OCR and text files use local quiz generation.

The API key is used only in the current browser session and is never committed to this repository. For a public production app, move the AI request behind a serverless backend before sharing it widely.

## GitHub Pages

The site deploys automatically from `main` using the workflow in `.github/workflows/deploy-pages.yml`. After the pull request is merged and the first workflow completes, it will be available at:

`https://realtruegeatee.github.io/study-quiz-generator/`
