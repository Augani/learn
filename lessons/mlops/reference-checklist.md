# Reference: Production ML Deployment Checklist

Use this checklist before deploying any ML model to production.
Check every item or document why it's not applicable.

---

## Pre-Training

```
  [ ] Problem well-defined with clear success metrics
  [ ] Baseline established (rule-based or simple model)
  [ ] Data collected, cleaned, and validated
  [ ] Data versioned and reproducible
  [ ] Train/val/test splits created (no data leakage)
  [ ] Feature engineering documented
  [ ] Privacy review completed (PII handled correctly)
  [ ] Bias assessment performed on training data
```

---

## Training

```
  [ ] Experiment tracking configured (MLflow, W&B, etc.)
  [ ] Hyperparameters documented
  [ ] Training is reproducible (random seeds, data version)
  [ ] Multiple model architectures compared
  [ ] Cross-validation performed (if applicable)
  [ ] Training time and cost recorded
  [ ] Model artifacts saved and versioned
```

---

## Evaluation

```
  [ ] Metrics computed on held-out test set
  [ ] Metrics meet minimum thresholds:
      [ ] Primary metric (accuracy/F1/AUC) above threshold
      [ ] Latency within requirements
      [ ] Model size within deployment constraints
  [ ] Performance analyzed across subgroups (fairness)
  [ ] Edge cases and failure modes documented
  [ ] Comparison against previous production model
  [ ] A/B test plan defined (if applicable)
  [ ] Stakeholder sign-off obtained
```

---

## Pre-Deployment

```
  [ ] Model serialized in serving format
  [ ] Inference code tested with unit tests
  [ ] Input validation implemented
  [ ] Output validation implemented (range checks, format)
  [ ] Error handling for malformed inputs
  [ ] Graceful degradation plan (fallback if model fails)
  [ ] Load testing completed:
      [ ] p50 latency < target
      [ ] p99 latency < target
      [ ] Throughput meets expected QPS
      [ ] Memory usage stable under load
  [ ] Security review:
      [ ] No credentials in code or artifacts
      [ ] Input sanitization (prevent injection)
      [ ] Rate limiting configured
      [ ] Authentication/authorization in place
```

---

## Deployment

```
  [ ] Docker container built and tested
  [ ] Container image tagged with model version
  [ ] Infrastructure provisioned:
      [ ] Compute resources (CPU/GPU)
      [ ] Auto-scaling configured
      [ ] Health check endpoints
  [ ] Deployment strategy chosen:
      [ ] Blue-green deployment
      [ ] Canary deployment (% traffic split)
      [ ] Shadow deployment (logging only)
  [ ] Rollback plan documented and tested
  [ ] DNS / routing configured
  [ ] SSL/TLS configured
```

---

## Monitoring

```
  [ ] System metrics monitored:
      [ ] CPU/GPU utilization
      [ ] Memory usage
      [ ] Disk usage
      [ ] Network I/O
  [ ] Application metrics monitored:
      [ ] Request latency (p50, p95, p99)
      [ ] Throughput (requests/sec)
      [ ] Error rate
      [ ] Queue depth
  [ ] Model metrics monitored:
      [ ] Prediction distribution
      [ ] Feature distribution drift
      [ ] Prediction drift
      [ ] Performance metrics (when labels available)
  [ ] Alerting configured:
      [ ] Latency spike alerts
      [ ] Error rate alerts
      [ ] Drift detection alerts
      [ ] Resource exhaustion alerts
  [ ] Dashboards created:
      [ ] Real-time operational dashboard
      [ ] Model performance dashboard
      [ ] Cost tracking dashboard
  [ ] Log aggregation configured
```

---

## Post-Deployment

```
  [ ] Canary metrics validated (if canary deploy)
  [ ] Full rollout completed
  [ ] Documentation updated:
      [ ] API documentation
      [ ] Model card
      [ ] Runbook for on-call
  [ ] On-call team briefed on new model
  [ ] Incident response plan updated
  [ ] Retraining pipeline configured:
      [ ] Trigger conditions defined
      [ ] Automated retraining tested
      [ ] Auto-deployment gates defined
```

---

## Data Pipeline

```
  [ ] Data sources documented
  [ ] Data freshness SLA defined
  [ ] Schema validation in place
  [ ] Data quality checks running:
      [ ] Null rate checks
      [ ] Range checks
      [ ] Distribution checks
      [ ] Uniqueness checks
  [ ] Data contracts with upstream teams
  [ ] Backfill strategy defined
  [ ] Data retention policy documented
```

---

## Incident Readiness

```
  [ ] Runbook written with:
      [ ] Common failure modes
      [ ] Diagnostic steps
      [ ] Rollback procedures
      [ ] Escalation paths
  [ ] Kill switch available (disable model, use fallback)
  [ ] Previous model version available for quick rollback
  [ ] Post-incident review template ready
  [ ] Communication plan for stakeholders
```

---

## Cost & Operations

```
  [ ] Cost estimate for serving documented
  [ ] Budget alerts configured
  [ ] Spot instance strategy (if applicable)
  [ ] Auto-scaling tested under load
  [ ] Scale-to-zero configured (if applicable)
  [ ] Resource tagging for cost attribution
```

---

## Compliance & Governance

```
  [ ] Model card created
  [ ] Data lineage documented
  [ ] Regulatory requirements met:
      [ ] GDPR compliance (if EU data)
      [ ] Right to explanation (if required)
      [ ] Audit trail available
  [ ] Model approved by review board (if required)
  [ ] Version control for all artifacts:
      [ ] Code
      [ ] Data
      [ ] Model
      [ ] Configuration
```

---

## Quick Pre-Flight Check

For fast iterations, at minimum check these before every deploy:

```
  +-------------------------------------------------------+
  | MUST-HAVE before any deployment:                       |
  |                                                        |
  | [ ] Test metrics > production model metrics            |
  | [ ] Load test passes at expected QPS                   |
  | [ ] Rollback tested and works                          |
  | [ ] Monitoring and alerts configured                   |
  | [ ] Canary or shadow deployment first                  |
  | [ ] Team aware of the deployment                       |
  +-------------------------------------------------------+
```
