const notesInput = document.querySelector("#notesInput");
const charCount = document.querySelector("#charCount");
const fileInput = document.querySelector("#fileInput");
const dropZone = document.querySelector("#dropZone");
const generateButton = document.querySelector("#generateButton");
const questionCount = document.querySelector("#questionCount");
const questionCountValue = document.querySelector("#questionCountValue");
const clearButton = document.querySelector("#clearButton");
const quizSection = document.querySelector("#quizSection");
const resultsSection = document.querySelector("#resultsSection");
const answers = document.querySelector("#answers");
const nextButton = document.querySelector("#nextButton");
const feedback = document.querySelector("#feedback");
const languageButton = document.querySelector("#languageButton");
const uploadStatus = document.querySelector("#uploadStatus");
const fileName = document.querySelector("#fileName");
const aiKeyInput = document.querySelector("#aiKey");
const mcqToggle = document.querySelector("#mcqToggle");
const trueFalseToggle = document.querySelector("#trueFalseToggle");

let quizLanguage = "en";
let quiz = [];
let sourceFile = null;
let currentQuestion = 0;
let score = 0;
let answered = false;
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const supportedExtensions = /\.(pdf|txt|md|png|jpe?g|webp)$/i;

const pdfjsReady = import("./vendor/pdfjs/pdf.min.mjs").then(pdfjs => {
  pdfjs.GlobalWorkerOptions.workerSrc = "./vendor/pdfjs/pdf.worker.min.mjs";
  return pdfjs;
});

const demoNotes = `Mitochondria are organelles found in most eukaryotic cells. They are often called the powerhouse of the cell because they produce ATP through cellular respiration.
Photosynthesis converts light energy into chemical energy. It takes place mainly in the chloroplasts of plant cells.
The cell membrane is selectively permeable, meaning it controls which substances enter and leave the cell.`;

const translations = {
  en: { next: "Next question", correct: "Correct! Nice work.", incorrect: "Not quite. Review this concept.", complete: "Quiz complete", score: "You got", ready: "Ready to learn" },
  de: { next: "Nächste Frage", correct: "Richtig! Gut gemacht.", incorrect: "Nicht ganz. Wiederhole dieses Konzept.", complete: "Quiz abgeschlossen", score: "Du hast", ready: "Bereit zum Lernen" }
};

function updateCount() {
  const count = notesInput.value.length;
  charCount.textContent = `${count.toLocaleString()} ${quizLanguage === "de" ? "Zeichen" : "characters"}`;
  const hasDirectFile = Boolean(sourceFile && aiKeyInput.value.trim());
  const hasQuestionType = mcqToggle.checked || trueFalseToggle.checked;
  generateButton.disabled = (!hasDirectFile && count < 30) || !hasQuestionType;
}

function getFileDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read the selected file."));
    reader.readAsDataURL(file);
  });
}

function getQuizSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["questions"],
    properties: {
      questions: {
        type: "array",
        minItems: 1,
        maxItems: 10,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["type", "question", "options", "answer"],
          properties: {
            type: { type: "string", enum: ["MULTIPLE CHOICE", "TRUE OR FALSE"] },
            question: { type: "string" },
            options: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 4 },
            answer: { type: "string" }
          }
        }
      }
    }
  };
}

async function makeFileAwareQuiz(file, count, language) {
  const apiKey = aiKeyInput.value.trim();
  if (!apiKey) return null;
  const fileData = await getFileDataUrl(file);
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  const types = [mcqToggle.checked ? "multiple choice" : "", trueFalseToggle.checked ? "true or false" : ""].filter(Boolean).join(" and ");
  const prompt = `Analyze the original study file, including its text, images, diagrams, tables, handwriting, and layout. Create exactly ${count} useful study questions in ${language === "de" ? "German" : "English"}. Use these question types when appropriate: ${types || "multiple choice"}. Return only the requested JSON. For multiple choice, include exactly four options and set answer to the exact correct option. For true or false, include exactly two options: True and False.`;
  const content = [
    { type: "input_text", text: prompt },
    isPdf
      ? { type: "input_file", filename: file.name, file_data: fileData }
      : { type: "input_image", image_url: fileData }
  ];
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      input: [{ role: "user", content }],
      text: { format: { type: "json_schema", name: "study_quiz", strict: true, schema: getQuizSchema() } }
    })
  });
  if (!response.ok) throw new Error(`AI request failed (${response.status}). Check the API key and model access.`);
  const result = await response.json();
  const outputText = result.output_text || result.output?.flatMap(item => item.content || []).find(item => item.type === "output_text")?.text;
  if (!outputText) throw new Error("The AI returned no quiz data. Please try again.");
  const parsed = JSON.parse(outputText);
  return parsed.questions.map(question => ({
    type: question.type,
    text: question.question,
    options: question.options,
    answer: question.answer
  }));
}

function splitSentences(text) {
  return text.replace(/\s+/g, " ").split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 35);
}

function makeQuiz(text, count, language) {
  const sentences = splitSentences(text);
  const source = sentences.length ? sentences : splitSentences(demoNotes);
  const questions = [];
  source.slice(0, count).forEach((sentence, index) => {
    const words = sentence.replace(/[.,!?;:()]/g, "").split(" ").filter(word => word.length > 5);
    const answer = words[Math.floor(words.length / 2)] || "cell";
    const prompt = language === "de"
      ? `Welcher Begriff vervollständigt diese Aussage?`
      : `Which term best completes this statement?`;
    const masked = sentence.replace(new RegExp(`\\b${answer}\\b`, "i"), "_____");
    const distractors = ["energy", "nucleus", "water", "protein", "reaction", "membrane"].filter(word => word.toLowerCase() !== answer.toLowerCase());
    const options = [answer, ...distractors.slice(index % 3, index % 3 + 3)].sort(() => Math.random() - .5);
    questions.push({ type: "MULTIPLE CHOICE", text: `${prompt}\n${masked}`, options, answer });
  });
  return questions;
}

function renderQuestion() {
  const item = quiz[currentQuestion];
  answered = false;
  nextButton.disabled = true;
  feedback.textContent = "";
  document.querySelector("#questionType").textContent = item.type;
  document.querySelector("#questionText").innerHTML = item.text.replace("\n", "<br>");
  document.querySelector("#progressText").textContent = `${currentQuestion + 1} / ${quiz.length}`;
  document.querySelector("#progressBar").style.width = `${((currentQuestion + 1) / quiz.length) * 100}%`;
  answers.innerHTML = "";
  item.options.forEach((option, index) => {
    const button = document.createElement("button");
    button.className = "answer";
    button.innerHTML = `<span class="answer-letter">${String.fromCharCode(65 + index)}</span><span>${option}</span>`;
    button.addEventListener("click", () => selectAnswer(button, option, item.answer));
    answers.appendChild(button);
  });
}

function selectAnswer(button, selected, correct) {
  if (answered) return;
  answered = true;
  document.querySelectorAll(".answer").forEach(option => {
    const value = option.querySelector("span:last-child").textContent;
    if (value === correct) option.classList.add("correct");
  });
  if (selected === correct) {
    score++;
    button.classList.add("correct");
    feedback.textContent = translations[quizLanguage].correct;
  } else {
    button.classList.add("incorrect");
    feedback.textContent = translations[quizLanguage].incorrect;
  }
  nextButton.disabled = false;
}

async function startQuiz() {
  const text = notesInput.value.trim();
  generateButton.disabled = true;
  uploadStatus.textContent = aiKeyInput.value.trim() && sourceFile
    ? "Analyzing the original file with AI..."
    : "Making a local quiz...";
  try {
    quiz = sourceFile && aiKeyInput.value.trim()
      ? await makeFileAwareQuiz(sourceFile, Number(questionCount.value), quizLanguage)
      : makeQuiz(text, Number(questionCount.value), quizLanguage);
    if (!quiz.length) throw new Error("No quiz questions were returned.");
  } catch (error) {
    console.error("Could not generate an AI quiz", error);
    uploadStatus.textContent = error.message;
    generateButton.disabled = false;
    return;
  }
  generateButton.disabled = false;
  currentQuestion = 0;
  score = 0;
  resultsSection.classList.add("hidden");
  quizSection.classList.remove("hidden");
  renderQuestion();
  quizSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

function finishQuiz() {
  quizSection.classList.add("hidden");
  resultsSection.classList.remove("hidden");
  document.querySelector("#scoreValue").textContent = score;
  document.querySelector("#totalValue").textContent = quiz.length;
  document.querySelector("#resultMessage").textContent = score === quiz.length
    ? (quizLanguage === "de" ? "Perfekt! Du beherrschst dieses Thema." : "Perfect! You’ve mastered this topic.")
    : `${translations[quizLanguage].score} ${score} ${quizLanguage === "de" ? "von" : "out of"} ${quiz.length}. ${quizLanguage === "de" ? "Weiter so!" : "Keep going!"}`;
  resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

notesInput.value = demoNotes;
updateCount();
notesInput.addEventListener("input", () => {
  if (sourceFile && notesInput.value !== "") {
    sourceFile = null;
    fileInput.value = "";
    fileName.textContent = "";
  }
  updateCount();
});
aiKeyInput.addEventListener("input", updateCount);
mcqToggle.addEventListener("change", updateCount);
trueFalseToggle.addEventListener("change", updateCount);
questionCount.addEventListener("input", () => { questionCountValue.textContent = questionCount.value; });
clearButton.addEventListener("click", () => {
  notesInput.value = "";
  sourceFile = null;
  fileInput.value = "";
  fileName.textContent = "";
  uploadStatus.textContent = "";
  updateCount();
  notesInput.focus();
});
generateButton.addEventListener("click", startQuiz);
nextButton.addEventListener("click", () => { currentQuestion++; currentQuestion < quiz.length ? renderQuestion() : finishQuiz(); });
document.querySelector("#retryButton").addEventListener("click", startQuiz);
document.querySelectorAll(".segmented button").forEach(button => button.addEventListener("click", () => {
  document.querySelectorAll(".segmented button").forEach(item => item.classList.remove("selected"));
  button.classList.add("selected");
  quizLanguage = button.dataset.value;
  languageButton.textContent = quizLanguage === "en" ? "DE" : "EN";
  document.querySelector("#savedLabel").textContent = translations[quizLanguage].ready;
  updateCount();
}));

async function extractPdfText(file) {
  const pdfjs = await pdfjsReady;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map(item => item.str).join(" "));
  }
  return pages.join("\n\n");
}

async function extractPdfWithOcr(file) {
  const pdfjs = await pdfjsReady;
  const tesseract = await import("./vendor/tesseract/tesseract.esm.min.js");
  const { createWorker } = tesseract.default || tesseract;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const worker = await createWorker(["eng", "deu"], 1, {
    workerPath: "./vendor/tesseract/worker.min.js",
    corePath: "./vendor/tesseract/tesseract-core-lstm.wasm.js",
    langPath: "./vendor/tessdata"
  });
  const pages = [];
  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      uploadStatus.textContent = `Reading scanned PDF page ${pageNumber} of ${pdf.numPages}...`;
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
      const result = await worker.recognize(canvas);
      pages.push(result.data.text);
    }
  } finally {
    await worker.terminate();
  }
  return pages.join("\n\n");
}

async function loadFile(file) {
  if (!file) return;
  if (!supportedExtensions.test(file.name)) {
    uploadStatus.textContent = "Unsupported file type. Use PDF, PNG, JPG, WEBP, TXT, or MD.";
    return;
  }
  if (file.size > MAX_FILE_SIZE) {
    uploadStatus.textContent = "That file is over the 25 MB limit. Choose a smaller file.";
    return;
  }
  sourceFile = file;
  fileName.textContent = file.name;
  try {
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const isImage = file.type.startsWith("image/");
    uploadStatus.textContent = isPdf ? "Reading PDF..." : "Loading notes...";
    if (isImage && !aiKeyInput.value.trim()) {
      notesInput.value = "";
      updateCount();
      uploadStatus.textContent = "Images need an AI key for direct visual understanding.";
      return;
    }
    let extractedText = isPdf ? await extractPdfText(file) : isImage ? "" : await file.text();
    if (isPdf && extractedText.trim().length < 30) {
      uploadStatus.textContent = "This looks like a scanned PDF. Reading the page images...";
      extractedText = await extractPdfWithOcr(file);
    }
    notesInput.value = extractedText;
    updateCount();
    uploadStatus.textContent = notesInput.value.trim().length < 30
      ? "No readable text found. Try a clearer PDF or paste notes."
      : "File loaded — ready to make a quiz.";
  } catch (error) {
    console.error("Could not read uploaded file", error);
    uploadStatus.textContent = "Could not read that file. Please try another PDF, TXT, or MD file.";
  }
}
fileInput.addEventListener("change", event => loadFile(event.target.files[0]));
["dragenter", "dragover"].forEach(eventName => dropZone.addEventListener(eventName, event => {
  event.preventDefault();
  dropZone.classList.add("dragging");
}));
["dragleave", "drop"].forEach(eventName => dropZone.addEventListener(eventName, event => {
  event.preventDefault();
  dropZone.classList.remove("dragging");
}));
dropZone.addEventListener("drop", event => loadFile(event.dataTransfer.files[0]));
