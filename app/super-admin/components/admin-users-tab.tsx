"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "sonner"
import { 
  UserPlus, 
  Pencil, 
  Trash2, 
  Key, 
  Shield, 
  Store, 
  Users,
  Search,
  ExternalLink,
  Copy,
  Check,
  Eye,
  EyeOff,
  Info,
  ChevronDown,
  ChevronUp
} from "lucide-react"

interface Restaurant {
  id: string
  name: string
  slug: string
}

type AdminRole = "super_admin" | "manager" | "csr" | "restaurant_admin"

interface AdminUser {
  id: string
  username: string
  email: string
  role: AdminRole
  restaurant_id: string | null
  created_at: string
  restaurants?: { name: string; slug: string } | null
}

interface AdminUsersTabProps {
  restaurants: Restaurant[]
}

export function AdminUsersTab({ restaurants }: AdminUsersTabProps) {
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState<"all" | AdminRole>("all")
  const [restaurantFilter, setRestaurantFilter] = useState<string>("all")
  
  // Create/Edit modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
  
  // Form state
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    role: "csr" as AdminRole,
    restaurant_id: ""
  })
  const [showPassword, setShowPassword] = useState(false)
  const [newPassword, setNewPassword] = useState("")
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showRoleInfo, setShowRoleInfo] = useState(false)

  // Fetch admin users
  useEffect(() => {
    fetchAdminUsers()
  }, [])

  const fetchAdminUsers = async () => {
    try {
      const response = await fetch("/api/admin-users")
      if (response.ok) {
        const data = await response.json()
        setAdminUsers(data)
      }
    } catch (error) {
      toast.error("Failed to fetch admin users")
    } finally {
      setLoading(false)
    }
  }

  // Filter admin users
  const filteredUsers = adminUsers.filter(user => {
    const matchesSearch = 
      user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.restaurants?.name || "").toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesRole = roleFilter === "all" || user.role === roleFilter
    const matchesRestaurant = restaurantFilter === "all" || user.restaurant_id === restaurantFilter
    
    return matchesSearch && matchesRole && matchesRestaurant
  })

  // Create admin user
  const handleCreate = async () => {
    if (!formData.username || !formData.email || !formData.password) {
      toast.error("Please fill in all required fields")
      return
    }
    
    if (formData.role === "restaurant_admin" && !formData.restaurant_id) {
      toast.error("Please select a restaurant for restaurant admin")
      return
    }

    setSaving(true)
    try {
      const response = await fetch("/api/admin-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        toast.success("Admin user created successfully")
        setIsCreateModalOpen(false)
        resetForm()
        fetchAdminUsers()
      } else {
        const error = await response.json()
        toast.error(error.error || "Failed to create admin user")
      }
    } catch (error) {
      toast.error("Failed to create admin user")
    } finally {
      setSaving(false)
    }
  }

  // Update admin user
  const handleUpdate = async () => {
    if (!selectedUser) return

    setSaving(true)
    try {
      const response = await fetch(`/api/admin-users/${selectedUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: formData.username,
          email: formData.email,
          role: formData.role,
          restaurant_id: formData.role === "restaurant_admin" ? formData.restaurant_id : null
        })
      })

      if (response.ok) {
        toast.success("Admin user updated successfully")
        setIsEditModalOpen(false)
        setSelectedUser(null)
        resetForm()
        fetchAdminUsers()
      } else {
        const error = await response.json()
        toast.error(error.error || "Failed to update admin user")
      }
    } catch (error) {
      toast.error("Failed to update admin user")
    } finally {
      setSaving(false)
    }
  }

  // Reset password
  const handleResetPassword = async () => {
    if (!selectedUser || !newPassword) return

    setSaving(true)
    try {
      const response = await fetch(`/api/admin-users/${selectedUser.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword })
      })

      if (response.ok) {
        toast.success("Password reset successfully")
        setIsResetPasswordModalOpen(false)
        setSelectedUser(null)
        setNewPassword("")
      } else {
        const error = await response.json()
        toast.error(error.error || "Failed to reset password")
      }
    } catch (error) {
      toast.error("Failed to reset password")
    } finally {
      setSaving(false)
    }
  }

  // Delete admin user
  const handleDelete = async (user: AdminUser) => {
    if (!confirm(`Are you sure you want to delete admin user "${user.username}"? This action cannot be undone.`)) {
      return
    }

    try {
      const response = await fetch(`/api/admin-users/${user.id}`, {
        method: "DELETE"
      })

      if (response.ok) {
        toast.success("Admin user deleted successfully")
        fetchAdminUsers()
      } else {
        const error = await response.json()
        toast.error(error.error || "Failed to delete admin user")
      }
    } catch (error) {
      toast.error("Failed to delete admin user")
    }
  }

  // Copy to clipboard
  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Generate random password
  const generatePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%"
    let password = ""
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return password
  }

  const resetForm = () => {
    setFormData({
      username: "",
      email: "",
      password: "",
      role: "csr",
      restaurant_id: ""
    })
    setShowPassword(false)
  }

  const openEditModal = (user: AdminUser) => {
    setSelectedUser(user)
    setFormData({
      username: user.username,
      email: user.email,
      password: "",
      role: user.role,
      restaurant_id: user.restaurant_id || ""
    })
    setIsEditModalOpen(true)
  }

  const openResetPasswordModal = (user: AdminUser) => {
    setSelectedUser(user)
    setNewPassword(generatePassword())
    setIsResetPasswordModalOpen(true)
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Admin Users</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage login credentials for super admins and restaurant admins
          </p>
          <button 
            onClick={() => setShowRoleInfo(!showRoleInfo)}
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 mt-2"
          >
            <Info className="h-4 w-4" />
            Role Permissions Guide
            {showRoleInfo ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { resetForm(); setFormData(prev => ({ ...prev, password: generatePassword() })) }}>
              <UserPlus className="h-4 w-4 mr-2" />
              Create Admin User
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create Admin User</DialogTitle>
              <DialogDescription>
                Create a new admin user with login credentials
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username *</Label>
                <Input
                  id="username"
                  placeholder="e.g., john.smith"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="e.g., john@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(formData.password, "create-password")}
                    title="Copy password"
                  >
                    {copiedId === "create-password" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setFormData({ ...formData, password: generatePassword() })}
                  >
                    Generate
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role *</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value: AdminRole) => 
                    setFormData({ ...formData, role: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="super_admin">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-rose-600" />
                        Super Admin
                      </div>
                    </SelectItem>
                    <SelectItem value="manager">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-purple-600" />
                        Manager
                      </div>
                    </SelectItem>
                    <SelectItem value="csr">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-teal-600" />
                        CSR (Customer Service)
                      </div>
                    </SelectItem>
                    <SelectItem value="restaurant_admin">
                      <div className="flex items-center gap-2">
                        <Store className="h-4 w-4 text-blue-600" />
                        Restaurant Admin
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formData.role === "restaurant_admin" && (
                <div className="space-y-2">
                  <Label htmlFor="restaurant">Restaurant *</Label>
                  <Select
                    value={formData.restaurant_id}
                    onValueChange={(value) => setFormData({ ...formData, restaurant_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a restaurant" />
                    </SelectTrigger>
                    <SelectContent>
                      {restaurants.map((restaurant) => (
                        <SelectItem key={restaurant.id} value={restaurant.id}>
                          {restaurant.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleCreate} disabled={saving}>
                {saving ? "Creating..." : "Create User"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Role Permissions Info */}
      {showRoleInfo && (
        <Card className="mb-6 border-blue-200 bg-blue-50/50">
          <CardContent className="pt-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {/* Super Admin */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge className="bg-rose-600">
                    <Shield className="h-3 w-3 mr-1" />
                    Super Admin
                  </Badge>
                </div>
                <ul className="text-sm text-slate-600 space-y-1 ml-1">
                  <li>- Full platform access</li>
                  <li>- Manage all restaurants</li>
                  <li>- Platform settings & operations</li>
                  <li>- Create/manage admin users</li>
                  <li>- View all orders & analytics</li>
                  <li>- Manage delivery fees & zones</li>
                </ul>
              </div>

              {/* Manager */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge className="bg-purple-600 text-white">
                    <Users className="h-3 w-3 mr-1" />
                    Manager
                  </Badge>
                </div>
                <ul className="text-sm text-slate-600 space-y-1 ml-1">
                  <li>- View all restaurants</li>
                  <li>- Manage orders across platform</li>
                  <li>- Access reports & analytics</li>
                  <li>- Handle customer issues</li>
                  <li>- Cannot modify platform settings</li>
                  <li>- Cannot create admin users</li>
                </ul>
              </div>

              {/* CSR */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge className="bg-teal-600 text-white">
                    <Users className="h-3 w-3 mr-1" />
                    CSR
                  </Badge>
                </div>
                <ul className="text-sm text-slate-600 space-y-1 ml-1">
                  <li>- Customer service representative</li>
                  <li>- View & manage orders</li>
                  <li>- Handle customer inquiries</li>
                  <li>- Process refunds (limited)</li>
                  <li>- Cannot access settings</li>
                  <li>- Cannot manage restaurants</li>
                </ul>
              </div>

              {/* Restaurant Admin */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    <Store className="h-3 w-3 mr-1" />
                    Restaurant Admin
                  </Badge>
                </div>
                <ul className="text-sm text-slate-600 space-y-1 ml-1">
                  <li>- Access only assigned restaurant</li>
                  <li>- Manage menu items & prices</li>
                  <li>- View restaurant orders</li>
                  <li>- Update restaurant settings</li>
                  <li>- Manage restaurant hours</li>
                  <li>- Cannot access other restaurants</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by username, email, or restaurant..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={roleFilter} onValueChange={(v: any) => setRoleFilter(v)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="super_admin">Super Admin</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="csr">CSR</SelectItem>
                <SelectItem value="restaurant_admin">Restaurant Admin</SelectItem>
              </SelectContent>
            </Select>
            <Select value={restaurantFilter} onValueChange={setRestaurantFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by restaurant" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Restaurants</SelectItem>
                {restaurants.map((restaurant) => (
                  <SelectItem key={restaurant.id} value={restaurant.id}>
                    {restaurant.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Admin Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Admin Users ({filteredUsers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No admin users found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Restaurant</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.username}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={user.role === "super_admin" ? "default" : "secondary"}
                        className={
                          user.role === "super_admin" ? "bg-rose-600" :
                          user.role === "manager" ? "bg-purple-600 text-white" :
                          user.role === "csr" ? "bg-teal-600 text-white" :
                          ""
                        }
                      >
                        {user.role === "super_admin" && <><Shield className="h-3 w-3 mr-1" /> Super Admin</>}
                        {user.role === "manager" && <><Users className="h-3 w-3 mr-1" /> Manager</>}
                        {user.role === "csr" && <><Users className="h-3 w-3 mr-1" /> CSR</>}
                        {user.role === "restaurant_admin" && <><Store className="h-3 w-3 mr-1" /> Restaurant Admin</>}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.restaurants ? (
                        <Button variant="link" className="p-0 h-auto" asChild>
                          <a href={`/${user.restaurants.slug}/admin`} target="_blank">
                            {user.restaurants.name}
                            <ExternalLink className="h-3 w-3 ml-1" />
                          </a>
                        </Button>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Intl.DateTimeFormat("es-PR", { timeZone: "America/Puerto_Rico", month: "short", day: "numeric", year: "numeric" }).format(new Date(user.created_at))}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditModal(user)}
                          title="Edit user"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openResetPasswordModal(user)}
                          title="Reset password"
                        >
                          <Key className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(user)}
                          className="text-destructive hover:text-destructive"
                          title="Delete user"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Admin User</DialogTitle>
            <DialogDescription>
              Update admin user details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-username">Username</Label>
              <Input
                id="edit-username"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">Role</Label>
              <Select
                value={formData.role}
                onValueChange={(value: AdminRole) => 
                  setFormData({ ...formData, role: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="csr">CSR</SelectItem>
                  <SelectItem value="restaurant_admin">Restaurant Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formData.role === "restaurant_admin" && (
              <div className="space-y-2">
                <Label htmlFor="edit-restaurant">Restaurant</Label>
                <Select
                  value={formData.restaurant_id}
                  onValueChange={(value) => setFormData({ ...formData, restaurant_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a restaurant" />
                  </SelectTrigger>
                  <SelectContent>
                    {restaurants.map((restaurant) => (
                      <SelectItem key={restaurant.id} value={restaurant.id}>
                        {restaurant.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Modal */}
      <Dialog open={isResetPasswordModalOpen} onOpenChange={setIsResetPasswordModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Reset password for {selectedUser?.username}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(newPassword, "reset-password")}
                  title="Copy password"
                >
                  {copiedId === "reset-password" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setNewPassword(generatePassword())}
                >
                  Generate
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Make sure to copy the password before saving - it won't be shown again.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsResetPasswordModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleResetPassword} disabled={saving}>
              {saving ? "Resetting..." : "Reset Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
