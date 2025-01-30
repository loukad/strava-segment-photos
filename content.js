// ==UserScript==
// @name         Leaderboard Photos
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Adds a "Photos" column to the leaderboard table and fetches photos dynamically.
// @author       Louka
// @match        https://www.strava.com/*
// @grant        GM_xmlhttpRequest
// @connect      strava.com
// ==/UserScript==
(async function () {
  const leaderboardTableSelector = "table.table-leaderboard";
  const popupSelector = ".mapboxgl-popup-content";
  let isUpdatingPopup = false; // Flag to track updates

  async function addPhotosToLeaderboard() {
    const leaderboardTable = document.querySelector(leaderboardTableSelector);
    if (!leaderboardTable) return;

    const headerRow = leaderboardTable.querySelector("thead tr");
    if (!headerRow.querySelector("th.photos-header")) {
      const photoHeader = document.createElement("th");
      photoHeader.classList.add("photos-header");
      photoHeader.innerText = "Photos";
      headerRow.appendChild(photoHeader);
    }

    const rows = leaderboardTable.querySelectorAll("tbody tr");
    for (const row of rows) {
      if (row.querySelector("td.photos-cell")) continue;
      const effortCell = row.querySelector('td a[href*="/segment_efforts/"]');
      if (!effortCell) continue;
      const effortUrl = effortCell.getAttribute("href");
      const photosCell = document.createElement("td");
      photosCell.classList.add("photos-cell");
      photosCell.innerText = "Loading...";
      row.appendChild(photosCell);
      try {
        const activityBody = await getActivityFromSegmentEffort(effortUrl);
        const photos = getPhotosFromActivityBody(activityBody);
        photosCell.innerHTML = photos.length
          ? photos.map(photoUrl => `<a href="${photoUrl}" target="_blank"><img src="${photoUrl}" style="width: 32px; height: 32px; margin-right: 5px;"></a>`).join("")
          : "No Photos";
      } catch {
        photosCell.innerText = "Error";
      }
    }
  }

  async function addPhotosToPopup() {
    if (isUpdatingPopup) return; // Prevent callbacks to this method while updating
    isUpdatingPopup = true;

    try {
      const popup = document.querySelector(popupSelector);
      if (!popup) return;

      const segmentLink = popup.querySelector('[class^="SegmentDetailsPopup"] a');
      if (!segmentLink) return;

      const segmentIdMatch = segmentLink.href.match(/segments\/(\d+)/);
      if (!segmentIdMatch) return;
      const segmentId = segmentIdMatch[1];

      // Create the images container
      const imagesContainer = document.createElement("div");
      imagesContainer.style.display = "flex"; // Ensure it aligns well with flex parent
      imagesContainer.style.flexDirection = "column"; // Stack images container above the button
      imagesContainer.style.width = "100%"; // Take full width
      imagesContainer.style.maxHeight = "160px";
      imagesContainer.style.overflowY = "auto"; // Scroll when needed
      imagesContainer.style.padding = "5px";
      imagesContainer.style.border = "1px solid #ccc";
      imagesContainer.style.background = "#fff"; // Ensure visibility
      imagesContainer.style.borderRadius = "5px";
      imagesContainer.style.marginBottom = "10px"; // Space between images and button

      // Create an inner grid for images
      const imagesGrid = document.createElement("div");
      imagesGrid.style.display = "grid";
      imagesGrid.style.gridTemplateColumns = "repeat(auto-fill, minmax(32px, 1fr))"; // Responsive columns
      imagesGrid.style.gridAutoRows = "32px"; // Fixed row height
      imagesGrid.style.gap = "5px";
      imagesGrid.style.width = "100%";

      // Add grid inside container
      imagesContainer.appendChild(imagesGrid);

      // Insert imagesContainer into the correct parent
      const segmentParent = segmentLink.parentElement.parentElement;
      if (segmentParent) {
          segmentParent.insertBefore(imagesContainer, segmentParent.firstChild);
      }

      const effortsResponse = await fetch(`https://www.strava.com/segments/${segmentId}`);
      const effortsHtml = await effortsResponse.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(effortsHtml, "text/html");
      const effortLinks = doc.querySelectorAll('a[href*="/segment_efforts/"]');
      for (const link of effortLinks) {
        const effortUrl = link.getAttribute("href");
        const activityBody = await getActivityFromSegmentEffort(effortUrl);
        const photos = getPhotosFromActivityBody(activityBody);

        // Append images inside the container
        photos.forEach(photoUrl => {
          const link = document.createElement("a");
          link.href = photoUrl;
          link.target = "_blank"; // Opens in a new tab/window

          const img = document.createElement("img");
          img.src = photoUrl;
          img.style.width = "100%";
          img.style.height = "100%";
          img.style.objectFit = "cover"; // Ensures proper fitting

          link.appendChild(img);
          imagesGrid.appendChild(link);
        });
      }
    } catch (error) {
      console.error("Error fetching popup photos:", error);
    } finally {
      isUpdatingPopup = false;
    }
  }

  async function getActivityFromSegmentEffort(segmentEffortUrl) {
    const response = await fetch(`https://www.strava.com${segmentEffortUrl}`);
    const match = response.url.match(/activities\/(\d+)/);
    if (!match) throw new Error("Activity ID not found");
    return response.text();
  }

  function getPhotosFromActivityBody(activityBody) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(activityBody, "text/html");
    const div = doc.querySelector("div[data-react-class='MediaThumbnailList']");
    if (!div) return [];
    const data = JSON.parse(div.getAttribute("data-react-props"));
    return data.items.map(item => item.large);
  }

  function observeChanges() {
    const observer = new MutationObserver(() => {
      addPhotosToLeaderboard();
      addPhotosToPopup();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  addPhotosToLeaderboard();
  addPhotosToPopup();
  observeChanges();
})();
