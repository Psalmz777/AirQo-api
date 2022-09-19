resource "google_pubsub_topic" "container_analysis_occurrences_v1beta1" {
  name    = "container-analysis-occurrences-v1beta1"
  project = "airqo-frontend"
}
# terraform import google_pubsub_topic.container_analysis_occurrences_v1beta1 projects/airqo-frontend/topics/container-analysis-occurrences-v1beta1
