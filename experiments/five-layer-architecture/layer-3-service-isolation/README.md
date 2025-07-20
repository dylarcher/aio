## Layer 3: Service Isolation and Fault Containment

This layer is critical for building resilient distributed systems. It prevents failures in one service from cascading and bringing down the entire application

### Circuit Breaker Pattern Implementation

The Circuit Breaker pattern is a design pattern used to detect failures and encapsulate the logic of preventing a failing service from being called repeatedly. It monitors calls to a service and, if the error rate exceeds a threshold, it “trips” the circuit, redirecting subsequent calls to a fallback mechanism or returning an error immediately. After a timeout, it allows a limited number of calls to “half-open” the circuit, testing if the service has recovered.

### Bulkhead Pattern for Resource Isolation

The Bulkhead pattern is another fault isolation technique inspired by the compartmentalization of a ship’s hull. It divides the system into isolated pools of resources (e.g., threads, connections, memory) for different types of requests or services. If one part of the system fails or becomes overloaded, it doesn’t exhaust the resources of others, preventing cascading failures.