# StudySpark

StudySpark is a lightweight bilingual study app that turns notes into practice quizzes in English or German.

## Run locally

This is a dependency-free browser MVP. Open `index.html` directly, or serve the folder with any static file server:

```bash
python3 -m http.server 4173
```

Paste notes or upload a `.txt`/`.md` file, choose the quiz language and question count, then generate a quiz. The current demo generates questions locally in the browser, so no API key or backend is required.

## GitHub Pages

The site deploys automatically from `main` using the workflow in `.github/workflows/deploy-pages.yml`. After the pull request is merged and the first workflow completes, it will be available at:

`https://realtruegeatee.github.io/study-quiz-generator/`
