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

  // Main function to add the photos column and populate images
  async function addPhotosColumn() {
    const leaderboardTable = document.querySelector(leaderboardTableSelector);
    if (!leaderboardTable) {
      console.error("Leaderboard table not found!");
      return;
    }

    const headerRow = leaderboardTable.querySelector("thead tr");
    if (!headerRow.querySelector("th.photos-header")) {
      const photoHeader = document.createElement("th");
      photoHeader.classList.add("photos-header");
      photoHeader.innerText = "Photos";
      headerRow.appendChild(photoHeader);
    }

    const rows = leaderboardTable.querySelectorAll("tbody tr");
    for (const row of rows) {
      if (row.querySelector("td.photos-cell")) continue; // Skip rows already processed

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

        if (photos.length > 0) {
          photosCell.innerHTML = photos
            .map(
              (photoUrl) =>
                `<a href="${photoUrl}" target="_blank">
                   <img src="${photoUrl}" alt="Thumbnail" style="width: 32px; height: 32px; margin-right: 5px;">
                 </a>`
            )
            .join("");
        } else {
          photosCell.innerText = "No Photos";
        }
      } catch (error) {
        console.error("Error fetching photos:", error);
        photosCell.innerText = "Error";
      }
    }
  }

  // Set up a MutationObserver to watch for table changes
  function observeTableChanges() {
    const container = document.body; // Observing the entire body for simplicity
    const observer = new MutationObserver(() => {
      const leaderboardTable = document.querySelector(leaderboardTableSelector);
      if (leaderboardTable) {
        addPhotosColumn(); // Re-run the logic when the table is found or changes
      }
    });

    observer.observe(container, {
      childList: true, // Detect added/removed child nodes
      subtree: true, // Observe all descendants
    });
  }

  // Helper: Get activity from a segment effort link
  async function getActivityFromSegmentEffort(segmentEffortUrl) {
    const fullUrl = `https://www.strava.com${segmentEffortUrl}`;
    const response = await fetch(fullUrl);
    const activityUrl = response.url; // Follows the redirect to the activity page
    const match = activityUrl.match(/activities\/(\d+)/);
    if (!match) throw new Error("Activity ID not found");

    return response.text();
  }

  // Helper: Get photos from activity page
  function getPhotosFromActivityBody(activityBody) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(activityBody, "text/html");

    const div = doc.querySelector("div[data-react-class='MediaThumbnailList']");
    if (!div) {
      return [];
    }

    // Parse the `data-react-props` attribute
    const data = JSON.parse(div.getAttribute("data-react-props"));

    // Extract the image URLs
    const imageUrls = data.items.map(item => item.large); // Change 'large' to 'thumbnail' if needed

    return imageUrls;
  }

  // Initial run and start observing
  addPhotosColumn();
  observeTableChanges();
})();
