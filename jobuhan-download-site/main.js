document.documentElement.classList.add("js-enabled");

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const revealItems = document.querySelectorAll(".reveal");

if (!reducedMotion && "IntersectionObserver" in window) {
  const observer = new IntersectionObserver((entries, currentObserver) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        currentObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.16, rootMargin: "0px 0px -35px 0px" });

  revealItems.forEach((item) => observer.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add("is-visible"));
}

const menuButton = document.querySelector(".nav-toggle");
const navigation = document.querySelector(".header-nav");

function closeMenu() {
  if (!menuButton || !navigation) return;
  menuButton.setAttribute("aria-expanded", "false");
  menuButton.setAttribute("aria-label", "メニューを開く");
  navigation.classList.remove("is-open");
}

menuButton?.addEventListener("click", () => {
  const isOpen = menuButton.getAttribute("aria-expanded") === "true";
  menuButton.setAttribute("aria-expanded", String(!isOpen));
  menuButton.setAttribute("aria-label", isOpen ? "メニューを開く" : "メニューを閉じる");
  navigation?.classList.toggle("is-open", !isOpen);
});

navigation?.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));
window.addEventListener("resize", () => {
  if (window.innerWidth > 900) closeMenu();
});

const faqDialog = document.querySelector(".faq-dialog");
document.querySelectorAll("[data-open-faq]").forEach((button) => {
  button.addEventListener("click", () => {
    closeMenu();
    if (faqDialog instanceof HTMLDialogElement && !faqDialog.open) faqDialog.showModal();
  });
});

document.querySelectorAll("[data-close-faq]").forEach((button) => {
  button.addEventListener("click", () => {
    if (faqDialog instanceof HTMLDialogElement) faqDialog.close();
  });
});

faqDialog?.addEventListener("click", (event) => {
  if (event.target === faqDialog && faqDialog instanceof HTMLDialogElement) faqDialog.close();
});

let toastTimer;
function showToast(message) {
  const toast = document.querySelector(".toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 4400);
}

document.querySelectorAll(".download-button, .faq-download").forEach((button) => {
  button.addEventListener("click", async (event) => {
    event.preventDefault();
    const url = button.getAttribute("href");
    if (!url) return;

    try {
      const response = await fetch(url, { method: "HEAD", cache: "no-store" });
      if (!response.ok) {
        showToast("Windows版インストーラーは現在準備中です。公開後、このボタンから .exe をダウンロードできます。");
        return;
      }
      const link = document.createElement("a");
      link.href = url;
      link.download = "jobuhan-setup.exe";
      document.body.append(link);
      link.click();
      link.remove();
    } catch {
      showToast("ダウンロードを開始できませんでした。時間をおいてもう一度お試しください。");
    }
  });
});
