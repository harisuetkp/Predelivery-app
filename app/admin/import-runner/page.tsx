"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

interface ImportResult {
  restaurant: string
  categories: number
  items: number
  options: number
  choices: number
  errors: string[]
}

export default function ImportRunnerPage() {
  const [isRunning, setIsRunning] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [total, setTotal] = useState(0)
  const [results, setResults] = useState<ImportResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [completed, setCompleted] = useState(false)

  const runImport = useCallback(async (index: number) => {
    try {
      const response = await fetch(`/api/import-restaurant?index=${index}`)
      const data = await response.json()
      
      if (data.error) {
        setError(data.error)
        setIsRunning(false)
        return
      }
      
      if (data.total) setTotal(data.total)
      
      if (data.results) {
        setResults(prev => [...prev, data.results])
      }
      
      if (data.completed) {
        setCompleted(true)
        setIsRunning(false)
      } else {
        setCurrentIndex(data.nextIndex)
      }
    } catch (err: any) {
      setError(err.message)
      setIsRunning(false)
    }
  }, [])

  useEffect(() => {
    if (isRunning && !completed) {
      runImport(currentIndex)
    }
  }, [isRunning, currentIndex, completed, runImport])

  const startImport = () => {
    setIsRunning(true)
    setCurrentIndex(0)
    setResults([])
    setError(null)
    setCompleted(false)
  }

  const totalImported = results.reduce((acc, r) => ({
    categories: acc.categories + r.categories,
    items: acc.items + r.items,
    options: acc.options + r.options,
    choices: acc.choices + r.choices,
  }), { categories: 0, items: 0, options: 0, choices: 0 })

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Full Data Import Runner</h1>
      
      <Card className="p-6 mb-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Import Status</h2>
              <p className="text-muted-foreground">
                {completed 
                  ? "Import completed!" 
                  : isRunning 
                    ? `Importing restaurant ${currentIndex + 1} of ${total || "?"}...` 
                    : "Ready to import"}
              </p>
            </div>
            <Button 
              onClick={startImport} 
              disabled={isRunning}
              size="lg"
            >
              {isRunning ? "Importing..." : completed ? "Re-run Import" : "Start Import"}
            </Button>
          </div>
          
          {total > 0 && (
            <Progress value={(currentIndex / total) * 100} className="h-3" />
          )}
          
          {error && (
            <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
              Error: {error}
            </div>
          )}
        </div>
      </Card>

      <Card className="p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Totals</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-muted p-4 rounded-lg text-center">
            <div className="text-3xl font-bold">{results.length}</div>
            <div className="text-muted-foreground">Restaurants</div>
          </div>
          <div className="bg-muted p-4 rounded-lg text-center">
            <div className="text-3xl font-bold">{totalImported.categories}</div>
            <div className="text-muted-foreground">Categories</div>
          </div>
          <div className="bg-muted p-4 rounded-lg text-center">
            <div className="text-3xl font-bold">{totalImported.items}</div>
            <div className="text-muted-foreground">Menu Items</div>
          </div>
          <div className="bg-muted p-4 rounded-lg text-center">
            <div className="text-3xl font-bold">{totalImported.options}</div>
            <div className="text-muted-foreground">Options</div>
          </div>
        </div>
      </Card>

      {results.length > 0 && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Import Log</h2>
          <div className="max-h-96 overflow-y-auto space-y-2">
            {results.map((result, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="font-medium">{result.restaurant}</span>
                <span className="text-sm text-muted-foreground">
                  {result.categories} cats, {result.items} items, {result.options} opts, {result.choices} choices
                  {result.errors.length > 0 && (
                    <span className="text-destructive ml-2">({result.errors.length} errors)</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
