FROM mcr.microsoft.com/dotnet/sdk:10.0-preview AS build
WORKDIR /src

# Copy solution and project files
COPY ["SaveFW.sln", "./"]
COPY ["SaveFW.Server/SaveFW.Server.csproj", "SaveFW.Server/"]
COPY ["SaveFW.Client/SaveFW.Client.csproj", "SaveFW.Client/"]
COPY ["SaveFW.Shared/SaveFW.Shared.csproj", "SaveFW.Shared/"]

# Restore dependencies
RUN dotnet restore

# Copy the rest of the source code
COPY . .

# Build the project
WORKDIR "/src/SaveFW.Server"
RUN dotnet build "SaveFW.Server.csproj" -c Release -o /app/build

# Publish the project
FROM build AS publish
RUN dotnet publish "SaveFW.Server.csproj" -c Release -o /app/publish

# Final stage/image
FROM mcr.microsoft.com/dotnet/aspnet:10.0-preview AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "SaveFW.Server.dll"]
