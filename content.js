(async function () {
  // Add a new "Photos" column header
  const leaderboardTable = document.querySelector("table.table-leaderboard");
  if (!leaderboardTable) {
    console.error("Leaderboard table not found!");
    return;
  }

  const headerRow = leaderboardTable.querySelector("thead tr");
  const photoHeader = document.createElement("th");
  photoHeader.innerText = "Photos";
  headerRow.appendChild(photoHeader);

  // Iterate over leaderboard rows and process each segment effort
  const rows = leaderboardTable.querySelectorAll("tbody tr");
  for (const row of rows) {
    const effortCell = row.querySelector('td a[href*="/segment_efforts/"]');
    if (!effortCell) continue;

    const effortUrl = effortCell.getAttribute("href");
    const photosCell = document.createElement("td");
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
    const data = JSON.parse(div.getAttribute('data-react-props'));

    // Extract the image URLs
    const imageUrls = data.items.map(item => item.large); // Change 'large' to 'thumbnail' if needed

    return imageUrls;
  }
})();
