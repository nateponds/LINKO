Courier/Parcel Tracking:
Objective: To manage the lifecycle of a delivery from pickup to drop-off. The system records sender and receiver details, calculates shipping costs based on weight, and maintains a real-time log of the parcel’s journey through various transit points.
Functionalities: Log sender/receiver info, package weight, and current delivery status.
The 5 Core Tables
Service_Tiers: Defines delivery speeds (e.g., Standard, Express, Next-Day) and their base rates per kilogram.
Customers: A shared table for both Senders and Receivers to store addresses and contact info.
Branches: The physical hubs or warehouses where parcels are processed (e.g., Cebu Hub, Manila Sortation Center).
Parcels: The master record for each package, including weight, dimensions, and the current assigned status.
Tracking_Logs: The "History" table that records every time a parcel is scanned at a new location or changes status.
