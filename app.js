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

let quizLanguage = "en";
let quiz = [];
let currentQuestion = 0;
let score = 0;
let answered = false;

const pdfjsReady = import("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs").then(pdfjs => {
  pdfjs.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";
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
  generateButton.disabled = count < 30;
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

function startQuiz() {
  const text = notesInput.value.trim();
  quiz = makeQuiz(text, Number(questionCount.value), quizLanguage);
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
notesInput.addEventListener("input", updateCount);
questionCount.addEventListener("input", () => { questionCountValue.textContent = questionCount.value; });
clearButton.addEventListener("click", () => { notesInput.value = ""; updateCount(); notesInput.focus(); });
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
  const document = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map(item => item.str).join(" "));
  }
  return pages.join("\n\n");
}

async function loadFile(file) {
  if (!file) return;
  try {
    notesInput.value = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
      ? await extractPdfText(file)
      : await file.text();
    updateCount();
    if (notesInput.value.trim().length < 30) {
      feedback.textContent = "This file has little or no selectable text. Try a text-based PDF or paste notes.";
    }
  } catch (error) {
    console.error("Could not read uploaded file", error);
    feedback.textContent = "Could not read that file. Please try another PDF, TXT, or MD file.";
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
