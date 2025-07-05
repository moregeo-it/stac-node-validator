// STAC Validator JavaScript using stac-node-validator bundle
class STACValidator {
	constructor() {
		console.log("STACValidator initialized");
		this.init();
	}

	init() {
		this.setupEventListeners();
		this.populateFromQueryParams();
	}

	populateFromQueryParams() {
		const urlParams = new URLSearchParams(window.location.search);
		const urlParam = urlParams.get('url');
		
		if (urlParam) {
			const urlInput = document.getElementById("stacUrl");
			urlInput.value = urlParam.trim();
			
			// Trigger the background JSON population
			this.populateJsonFromUrl();
		}
	}

	setupEventListeners() {
		const form = document.getElementById("validationForm");
		const urlMethodRadio = document.getElementById("urlMethod");
		const jsonMethodRadio = document.getElementById("jsonMethod");

		console.log("Setting up event listeners");

		// Handle form submission
		form.addEventListener("submit", (e) => {
			e.preventDefault();
			if (urlMethodRadio.checked) {
				this.populateJsonFromUrl();
			}
			this.validateInput();
		});

		// Handle method toggle
		urlMethodRadio.addEventListener("change", () => {
			if (urlMethodRadio.checked) {
				document.getElementById("urlInput").classList.remove("d-none");
				document.getElementById("jsonInput").classList.add("d-none");
			}
		});

		jsonMethodRadio.addEventListener("change", () => {
			if (jsonMethodRadio.checked) {
				document.getElementById("urlInput").classList.add("d-none");
				document.getElementById("jsonInput").classList.remove("d-none");
			}
		});
	}

	async validateInput() {
		const method = document.querySelector(
			'input[name="validationMethod"]:checked'
		).value;

		if (method === "url") {
			await this.validateURL();
		} else {
			await this.validateJSON();
		}
	}

	async validateURL() {
		const url = document.getElementById("stacUrl").value.trim();
		if (!url) {
			this.showError("Please enter a valid URL");
			return;
		}

		this.showLoading();

		try {
			// Fetch the STAC content from the URL
			const response = await axios.get(url);
			const stacData = response.data;

			// Validate the fetched data
			await this.performValidation(stacData);
		} catch (error) {
			this.showError(`Error fetching URL: ${error.message}`);
		}
	}

	async validateJSON() {
		const jsonText = document.getElementById("stacJson").value.trim();

		if (!jsonText) {
			this.showError("Please enter valid JSON");
			return;
		}

		this.showLoading();

		try {
			// Parse the JSON
			const stacData = JSON.parse(jsonText);

			// Validate the parsed data
			await this.performValidation(stacData);
		} catch (error) {
			this.showError(`Error parsing JSON: ${error.message}`);
		}
	}

	async performValidation(stacData) {
		try {
			// Check if the validate function is available from the bundle
			if (typeof validate === "undefined") {
				throw new Error("STAC validator bundle not loaded properly");
			}

			// Use the validate function from the bundle
			const report = await validate(stacData);

			// Convert the report to our results format
			const results = this.convertReportToResults(report);

			this.showResults(results);
		} catch (error) {
			this.showError(`Validation error: ${error.message}`);
		}
	}

	convertReportToResults(report) {
		const results = {
			valid: report.valid,
			errors: [],
		};

		// Collect errors from all sources
		if (report.results.core && report.results.core.length > 0) {
			results.errors.push(
				...report.results.core.map((error) => ({
					field: error.instancePath || error.dataPath || "core",
					message: error.message,
					schema: error.schemaPath || "core",
				}))
			);
		}

		if (report.results.extensions) {
			Object.entries(report.results.extensions).forEach(([ext, errors]) => {
				if (errors && errors.length > 0) {
					results.errors.push(
						...errors.map((error) => ({
							field: error.instancePath || error.dataPath || ext,
							message: error.message,
							schema: error.schemaPath || ext,
						}))
					);
				}
			});
		}

		if (report.results.custom && report.results.custom.length > 0) {
			results.errors.push(
				...report.results.custom.map((error) => ({
					field: error.instancePath || error.dataPath || "custom",
					message: error.message,
					schema: error.schemaPath || "custom",
				}))
			);
		}

		// Add any general messages as errors if validation failed
		if (!report.valid && report.messages && report.messages.length > 0) {
			results.errors.push(
				...report.messages.map((message) => ({
					field: "general",
					message: message,
					schema: "general",
				}))
			);
		}

		return results;
	}

	showLoading() {
		document.getElementById("loadingState").classList.remove("d-none");
		document.getElementById("results").classList.add("d-none");
		document.getElementById("validateBtn").disabled = true;
	}

	showResults(results) {
		document.getElementById("loadingState").classList.add("d-none");
		document.getElementById("validateBtn").disabled = false;

		const resultsDiv = document.getElementById("results");
		const statusDiv = document.getElementById("resultStatus");
		const contentDiv = document.getElementById("resultContent");
		const headerDiv = resultsDiv.querySelector(".card-header");
		const headerTitle = resultsDiv.querySelector(".card-header h5");
		const cardBody = resultsDiv.querySelector(".card-body");

		// Update header based on validation result
		if (results.valid) {
			headerDiv.classList.remove("validation-error");
			headerDiv.classList.add("validation-success");
			headerTitle.innerHTML = '<i class="fas fa-check me-2"></i>Checks PASSED';
			statusDiv.innerHTML = ""; // Remove badge
		} else {
			headerDiv.classList.remove("validation-success");
			headerDiv.classList.add("validation-error");
			headerTitle.innerHTML =
				'<i class="fas fa-triangle-exclamation me-2"></i>Checks FAILED';
			statusDiv.innerHTML = ""; // Remove badge
		}

		// Build content only if there are errors
		let html = "";
		if (results.errors.length > 0) {
			results.errors.forEach((error) => {
				html += `
                    <div class="validation-error mb-3 p-3 border-start border-3 bg-light" style="border-color: #dc3545 !important;">
                        <h6 style="color: #dc3545;">${
													error.field || "Unknown field"
												}</h6>
                        <p class="mb-1">${error.message}</p>
                        ${
													error.schema
														? `<small class="text-muted">Schema: ${error.schema}</small>`
														: ""
												}
                    </div>
                `;
			});
		}

		// Show/hide card-body based on whether there are errors
		if (results.errors.length > 0) {
			contentDiv.innerHTML = html;
			cardBody.classList.remove("d-none");
		} else {
			contentDiv.innerHTML = "";
			cardBody.classList.add("d-none");
		}

		resultsDiv.classList.remove("d-none");
		resultsDiv.classList.add("fade-in");
	}

	showError(message) {
		document.getElementById("loadingState").classList.add("d-none");
		document.getElementById("validateBtn").disabled = false;

		const resultsDiv = document.getElementById("results");
		const statusDiv = document.getElementById("resultStatus");
		const contentDiv = document.getElementById("resultContent");
		const headerDiv = resultsDiv.querySelector(".card-header");
		const headerTitle = resultsDiv.querySelector(".card-header h5");

		// Update header for error state
		headerDiv.classList.remove("validation-success");
		headerDiv.classList.add("validation-error");
		headerTitle.innerHTML =
			'<i class="fas fa-clipboard-check me-2"></i>Validation Results - Error';
		statusDiv.innerHTML = ""; // Remove badge

		contentDiv.innerHTML = `
            <div class="alert alert-danger">
                <h6><i class="fas fa-exclamation-triangle me-1"></i>Error</h6>
                <p>${message}</p>
            </div>
        `;

		resultsDiv.classList.remove("d-none");
		resultsDiv.classList.add("fade-in");
	}

	async populateJsonFromUrl() {
		const url = document.getElementById("stacUrl").value.trim();

		// Only try to fetch if URL looks valid and is not empty
		if (!url || !this.isValidUrl(url)) {
			return;
		}

		try {
			// Fetch the STAC content from the URL silently
			const response = await axios.get(url, {
				timeout: 5000, // 5 second timeout
				headers: {
					Accept: "application/json",
				},
			});

			// Only populate if we got valid JSON and textarea is still empty
			const jsonTextarea = document.getElementById("stacJson");
			if (response.data && typeof response.data === "object" && jsonTextarea.value.trim() === "") {
				jsonTextarea.value = JSON.stringify(response.data, null, 2);
			}
		} catch (error) {
			// Silently fail - don't show any errors to user
		}
	}

	isValidUrl(string) {
		try {
			const url = new URL(string);
			return url.protocol === "http:" || url.protocol === "https:";
		} catch (_) {
			return false;
		}
	}
}

// Initialize the validator when the DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
	new STACValidator();
});
